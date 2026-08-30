import sharp, { type Sharp } from 'sharp';
import {
  DEFAULT_MAX_IMAGE_DIMENSION,
  DEFAULT_MAX_IMAGE_PIXELS,
  type AllowedContentType,
  type UploadValidationOptions,
} from './content-types.js';
import type { UploadAssetKind } from './types.js';

export type MediaVariantName = 'sm' | 'md' | 'lg';

export type MediaVariantBytes = {
  name: MediaVariantName;
  contentType: 'image/webp';
  body: Uint8Array;
  width: number;
  height: number;
};

export type ProcessedImage = {
  body: Uint8Array;
  contentType: Extract<AllowedContentType, `image/${string}`>;
  width: number;
  height: number;
  variants: MediaVariantBytes[];
};

type VariantPreset = {
  name: MediaVariantName;
  width: number;
  height?: number;
  fit: 'cover' | 'contain' | 'inside';
};

/** Stable output sizes. Attachments deliberately have no responsive variants. */
export const MEDIA_VARIANT_PRESETS: Readonly<
  Record<Exclude<UploadAssetKind, 'attachment'>, readonly VariantPreset[]>
> = {
  avatar: [
    { name: 'sm', width: 96, height: 96, fit: 'cover' },
    { name: 'md', width: 256, height: 256, fit: 'cover' },
  ],
  logo: [
    { name: 'sm', width: 160, height: 160, fit: 'contain' },
    { name: 'md', width: 400, height: 400, fit: 'contain' },
  ],
  banner: [
    { name: 'md', width: 768, height: 432, fit: 'cover' },
    { name: 'lg', width: 1600, height: 900, fit: 'cover' },
  ],
  post_image: [
    { name: 'sm', width: 640, fit: 'inside' },
    { name: 'md', width: 1280, fit: 'inside' },
    { name: 'lg', width: 2000, fit: 'inside' },
  ],
};

function positiveLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Upload limits must be positive safe integers');
  }
  return value;
}

function imageType(contentType: AllowedContentType): ProcessedImage['contentType'] | null {
  return contentType.startsWith('image/') ? (contentType as ProcessedImage['contentType']) : null;
}

function canonicalEncoder(pipeline: Sharp, contentType: ProcessedImage['contentType']): Sharp {
  switch (contentType) {
    case 'image/jpeg':
      return pipeline.jpeg({ quality: 90, progressive: true, chromaSubsampling: '4:4:4' });
    case 'image/png':
      return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    case 'image/gif':
      return pipeline.gif({ effort: 7 });
    case 'image/webp':
      return pipeline.webp({ quality: 90, effort: 4 });
  }
}

async function toBuffer(
  pipeline: Sharp,
): Promise<{ body: Uint8Array; width: number; height: number }> {
  const result = await pipeline.toBuffer({ resolveWithObject: true });
  if (!result.info.width || !result.info.height) throw new Error('Image has invalid dimensions');
  return {
    body: new Uint8Array(result.data),
    width: result.info.width,
    height: result.info.height,
  };
}

/** Decode and re-encode a raster upload. Sharp enforces the pixel ceiling while decoding. */
export async function processImage(
  body: Uint8Array,
  contentType: AllowedContentType,
  assetKind: UploadAssetKind,
  options: UploadValidationOptions = {},
): Promise<ProcessedImage | null> {
  const type = imageType(contentType);
  if (!type) return null;

  const maxPixels = positiveLimit(options.maxImagePixels, DEFAULT_MAX_IMAGE_PIXELS);
  const maxDimension = positiveLimit(options.maxImageDimension, DEFAULT_MAX_IMAGE_DIMENSION);
  const input = sharp(body, {
    animated: false,
    failOn: 'error',
    limitInputPixels: maxPixels,
    sequentialRead: true,
  });
  const metadata = await input.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > maxDimension ||
    metadata.height > maxDimension ||
    metadata.width * metadata.height > maxPixels
  ) {
    throw new Error('Image dimensions are invalid or exceed the safety limit');
  }

  // rotate() applies EXIF orientation. Sharp omits metadata unless withMetadata() is called.
  const oriented = input.clone().rotate();
  const canonical = await toBuffer(canonicalEncoder(oriented.clone(), type));
  const variants: MediaVariantBytes[] = [];
  if (assetKind !== 'attachment') {
    for (const preset of MEDIA_VARIANT_PRESETS[assetKind]) {
      const resized = oriented.clone().resize({
        width: preset.width,
        ...(preset.height === undefined ? {} : { height: preset.height }),
        fit: preset.fit,
        withoutEnlargement: true,
        ...(preset.fit === 'contain' ? { background: { r: 0, g: 0, b: 0, alpha: 0 } } : {}),
      });
      const output = await toBuffer(resized.webp({ quality: 82, effort: 4 }));
      variants.push({
        name: preset.name,
        contentType: 'image/webp',
        body: output.body,
        width: output.width,
        height: output.height,
      });
    }
  }

  return {
    body: canonical.body,
    contentType: type,
    width: canonical.width,
    height: canonical.height,
    variants,
  };
}
