import {
  contentAddressedKey,
  newUploadId,
  assertFinalBucket,
  assertQuarantineKey,
  quarantineKey,
} from './keys.js';
import {
  assertUploadSize,
  extensionForContentType,
  normalizeContentType,
  validateUpload,
  type UploadValidationOptions,
} from './content-types.js';
import { processImage } from './media.js';
import {
  createMalwareScannerFromEnv,
  MalwareDetectedError,
  MalwareScannerUnavailableError,
} from './scanner.js';
import { LocalStorageClient } from './local-storage.js';
import { S3StorageClient, type S3Config } from './s3-storage.js';
import {
  BUCKETS,
  type BucketName,
  type PutObjectMeta,
  type QuarantineFlow,
  type QuarantineValidator,
  type ValidationResult,
  type PresignedUrl,
  type PromotedVariant,
  type MalwareScanner,
} from './types.js';

type StorageImplementation = LocalStorageClient | S3StorageClient;

export class SafeQuarantineValidator implements QuarantineValidator {
  constructor(private readonly options: UploadValidationOptions = {}) {}

  async validate(
    _key: string,
    contentType: string,
    body: Uint8Array,
    assetKind?: PutObjectMeta['assetKind'],
  ): Promise<ValidationResult> {
    const validated = validateUpload(body, contentType, {
      ...this.options,
      stripMetadata: false,
      ...(assetKind === undefined ? {} : { assetKind }),
    });
    if (!validated.ok) return validated;
    if (!validated.contentType.startsWith('image/')) {
      return { ok: true, contentType: validated.contentType, body: validated.body };
    }
    try {
      const processed = await processImage(
        validated.body,
        validated.contentType,
        assetKind ?? 'attachment',
        this.options,
      );
      if (!processed) return { ok: true, contentType: validated.contentType, body: validated.body };
      return {
        ok: true,
        contentType: processed.contentType,
        body: processed.body,
        width: processed.width,
        height: processed.height,
        variants: processed.variants,
      };
    } catch {
      return { ok: false, reason: 'Image could not be decoded safely' };
    }
  }
}

async function putQuarantineBody(
  storage: StorageImplementation,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  if (storage instanceof LocalStorageClient) {
    await storage.putLocal(BUCKETS.quarantine, key, body, contentType);
  } else {
    await storage.putObject(BUCKETS.quarantine, key, body, {
      contentType,
      contentLength: body.length,
    });
  }
}

async function deleteIfPresent(storage: StorageImplementation, bucket: BucketName, key: string) {
  try {
    await storage.deleteObject(bucket, key);
  } catch {
    // Quarantine cleanup is best effort; the database never references an incomplete variant.
  }
}

export class QuarantineStorageFlow implements QuarantineFlow {
  private readonly validator: QuarantineValidator;
  private readonly limits: UploadValidationOptions;
  private readonly scanner: MalwareScanner | null;

  constructor(
    private readonly storage: StorageImplementation,
    options: {
      validator?: QuarantineValidator;
      scanner?: MalwareScanner | null;
      limits?: UploadValidationOptions;
    } = {},
  ) {
    this.validator = options.validator ?? new SafeQuarantineValidator(options.limits);
    this.limits = options.limits ?? {};
    this.scanner = options.scanner === undefined ? createMalwareScannerFromEnv() : options.scanner;
  }

  private async scanBeforePromotion(contentType: string, body: Uint8Array): Promise<void> {
    if (contentType.startsWith('image/')) return;
    if (!this.scanner) throw new MalwareScannerUnavailableError();
    let result;
    try {
      result = await this.scanner.scan(body, contentType);
    } catch (error) {
      if (error instanceof MalwareDetectedError) throw error;
      if (error instanceof MalwareScannerUnavailableError) throw error;
      throw new MalwareScannerUnavailableError();
    }
    if (result.clean !== true && result.clean !== false) {
      throw new MalwareScannerUnavailableError();
    }
    if (!result.clean) {
      throw new MalwareDetectedError(
        result.reason ? `Malware detected: ${result.reason}` : undefined,
      );
    }
  }

  async quarantinePut(key: string, meta: PutObjectMeta): Promise<PresignedUrl> {
    assertQuarantineKey(key);
    assertUploadSize(meta.contentType, meta.contentLength, {
      ...this.limits,
      ...(meta.assetKind === undefined ? {} : { assetKind: meta.assetKind }),
    });
    return this.storage.presignPut(BUCKETS.quarantine, key, meta);
  }

  async validateAndPromote(
    key: string,
    targetBucket: BucketName,
    body: Uint8Array,
    validator = this.validator,
    expected?: {
      contentType?: string;
      contentLength?: number;
      assetKind?: PutObjectMeta['assetKind'];
      beforePromote?: (prepared: {
        targetKey: string;
        contentType: string;
        contentLength: number;
        width?: number;
        height?: number;
        variants: PromotedVariant[];
      }) => Promise<void>;
    },
  ): Promise<{
    targetKey: string;
    contentType: string;
    contentLength: number;
    width?: number;
    height?: number;
    variants: PromotedVariant[];
  }> {
    assertQuarantineKey(key);
    assertFinalBucket(targetBucket);
    if (!(body instanceof Uint8Array)) throw new Error('Upload body must be bytes');
    if (expected?.contentLength !== undefined && body.length !== expected.contentLength) {
      throw new Error('Upload size does not match presigned metadata');
    }

    const actual = validateUpload(body, expected?.contentType, {
      ...this.limits,
      stripMetadata: false,
      ...(expected?.assetKind === undefined ? {} : { assetKind: expected.assetKind }),
    });
    if (!actual.ok) throw new Error(actual.reason);
    const firstResult = await validator.validate(
      key,
      actual.contentType,
      actual.body,
      expected?.assetKind,
    );
    if (!firstResult.ok) throw new Error(firstResult.reason);
    if (normalizeContentType(firstResult.contentType) !== actual.contentType) {
      throw new Error('Validator content type does not match file bytes');
    }

    const promotedBody = firstResult.body ?? actual.body;
    const finalResult = validateUpload(promotedBody, actual.contentType, {
      ...this.limits,
      stripMetadata: false,
      ...(expected?.assetKind === undefined ? {} : { assetKind: expected.assetKind }),
    });
    if (!finalResult.ok) throw new Error(finalResult.reason);
    await this.scanBeforePromotion(finalResult.contentType, finalResult.body);
    const variantNames = new Set<string>();
    for (const variant of firstResult.variants ?? []) {
      if (
        !['sm', 'md', 'lg'].includes(variant.name) ||
        variantNames.has(variant.name) ||
        !(variant.body instanceof Uint8Array) ||
        variant.body.length === 0 ||
        !Number.isSafeInteger(variant.width) ||
        !Number.isSafeInteger(variant.height) ||
        variant.width <= 0 ||
        variant.height <= 0
      ) {
        throw new Error('Validator returned invalid image variant');
      }
      variantNames.add(variant.name);
      try {
        assertUploadSize(variant.contentType, variant.body.length, this.limits);
      } catch {
        throw new Error('Validator returned oversized image variant');
      }
    }
    const targetKey = contentAddressedKey(
      finalResult.body,
      extensionForContentType(finalResult.contentType),
    );

    const preparedVariants: PromotedVariant[] = (firstResult.variants ?? []).map((variant) => ({
      name: variant.name,
      targetKey: contentAddressedKey(variant.body, 'webp'),
      contentType: variant.contentType,
      contentLength: variant.body.length,
      width: variant.width,
      height: variant.height,
    }));
    await expected?.beforePromote?.({
      targetKey,
      contentType: finalResult.contentType,
      contentLength: finalResult.body.length,
      ...(firstResult.width === undefined ? {} : { width: firstResult.width }),
      ...(firstResult.height === undefined ? {} : { height: firstResult.height }),
      variants: preparedVariants,
    });

    if (this.storage instanceof LocalStorageClient) {
      // Local completion may receive bytes directly from a development upload fixture.
    } else {
      const remoteBody = await this.storage.getObject(BUCKETS.quarantine, key);
      if (
        !remoteBody.every((value, index) => value === body[index]) ||
        remoteBody.length !== body.length
      ) {
        throw new Error('Quarantine object changed during validation');
      }
    }
    await putQuarantineBody(this.storage, key, finalResult.body, finalResult.contentType);

    const stagedVariantKeys: string[] = [];
    try {
      for (const [index, variant] of (firstResult.variants ?? []).entries()) {
        const pendingKey = quarantineKey(newUploadId());
        const variantTargetKey = preparedVariants[index]?.targetKey;
        if (!variantTargetKey) throw new Error('Variant metadata is incomplete');
        await putQuarantineBody(this.storage, pendingKey, variant.body, variant.contentType);
        stagedVariantKeys.push(pendingKey);
        await this.storage.promoteFromQuarantine(pendingKey, targetBucket, variantTargetKey);
      }
      await this.storage.promoteFromQuarantine(key, targetBucket, targetKey);
    } catch (error) {
      await Promise.all(
        stagedVariantKeys.map((pendingKey) =>
          deleteIfPresent(this.storage, BUCKETS.quarantine, pendingKey),
        ),
      );
      throw error;
    }
    return {
      targetKey,
      contentType: finalResult.contentType,
      contentLength: finalResult.body.length,
      ...(firstResult.width === undefined ? {} : { width: firstResult.width }),
      ...(firstResult.height === undefined ? {} : { height: firstResult.height }),
      variants: preparedVariants,
    };
  }
}

export function createStorageClient(env: {
  s3Endpoint?: string | undefined;
  s3Region?: string | undefined;
  s3AccessKeyId?: string | undefined;
  s3SecretAccessKey?: string | undefined;
  localRoot?: string | undefined;
  nodeEnv?: string | undefined;
}): LocalStorageClient | S3StorageClient {
  if (!env.s3Endpoint) {
    if ((env.nodeEnv ?? process.env.NODE_ENV) === 'production') {
      throw new Error('S3_ENDPOINT is required in production');
    }
    return new LocalStorageClient(env.localRoot ?? './data/storage');
  }
  if (!env.s3AccessKeyId || !env.s3SecretAccessKey) {
    throw new Error('S3 credentials are required when S3_ENDPOINT is configured');
  }
  const config: S3Config = {
    endpoint: env.s3Endpoint,
    region: env.s3Region ?? 'auto',
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
    forcePathStyle: true,
  };
  return new S3StorageClient(config);
}

export function createQuarantineFlow(
  storage: StorageImplementation,
  options: {
    validator?: QuarantineValidator;
    scanner?: MalwareScanner | null;
    limits?: UploadValidationOptions;
  } = {},
): QuarantineStorageFlow {
  return new QuarantineStorageFlow(storage, options);
}

export { newUploadId, quarantineKey } from './keys.js';
