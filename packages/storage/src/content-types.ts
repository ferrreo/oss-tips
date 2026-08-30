import type { UploadAssetKind } from './types.js';

/** Content types accepted by beta upload pipeline. SVG and archives are deliberately excluded. */
export const ALLOWED_CONTENT_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_PIXELS = 40_000_000;
export const DEFAULT_MAX_IMAGE_DIMENSION = 10_000;
export const ASSET_LIMITS: Readonly<Record<UploadAssetKind, number>> = Object.freeze({
  avatar: 2 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
  banner: 8 * 1024 * 1024,
  post_image: 10 * 1024 * 1024,
  attachment: 25 * 1024 * 1024,
});

const ALLOWED = new Set<string>(ALLOWED_CONTENT_TYPES);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const DANGEROUS_PDF_TOKENS = /\/(?:javascript|js|openaction|launch|encrypt)\b/i;
const DANGEROUS_HTML_TAGS =
  /(?:<!doctype\s+html\b|<\/?\s*(?:html|head|body|title|script|iframe|object|embed|svg|style|form|meta)\b)/i;
const SHELL_SCRIPT = /^\uFEFF?\s*#!(?:\s*\/|\s*[A-Za-z][A-Za-z0-9_-]*\b)/;
const PHP_SCRIPT = /^\uFEFF?\s*<\?php\b/i;
const WINDOWS_SCRIPT = /^\uFEFF?\s*@echo\s+off\b/i;

export type UploadValidationOptions = {
  maxBytes?: number;
  maxImageBytes?: number;
  maxImagePixels?: number;
  maxImageDimension?: number;
  assetKind?: UploadAssetKind;
  /** Internal pipeline switch; decoded media sanitisation is performed by sharp. */
  stripMetadata?: boolean;
};

function optionOrDefault(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Upload limits must be positive safe integers');
  }
  return value;
}

/** Remove parameters and normalise a MIME type before comparing it with the allowlist. */
export function normalizeContentType(contentType: string): string {
  if (typeof contentType !== 'string' || CONTROL_CHARACTERS.test(contentType)) {
    throw new Error('Invalid content type');
  }
  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(normalized)) {
    throw new Error(`Invalid content type: ${contentType}`);
  }
  return normalized;
}

export function isAllowedContentType(contentType: string): contentType is AllowedContentType {
  try {
    return ALLOWED.has(normalizeContentType(contentType));
  } catch {
    return false;
  }
}

/** Compatibility alias; callers should treat this as an allowlist check. */
export function isDangerousContentType(contentType: string): boolean {
  return !isAllowedContentType(contentType);
}

export function assertSafeContentType(
  contentType: string,
): asserts contentType is AllowedContentType {
  const normalized = normalizeContentType(contentType);
  if (!ALLOWED.has(normalized)) {
    throw new Error(`Rejected content type: ${contentType}`);
  }
}

export function assertUploadSize(
  contentType: string,
  contentLength: number,
  options: UploadValidationOptions = {},
): void {
  const normalized = normalizeContentType(contentType);
  if (!ALLOWED.has(normalized)) throw new Error(`Rejected content type: ${contentType}`);
  if (
    options.assetKind !== undefined &&
    options.assetKind !== 'attachment' &&
    !normalized.startsWith('image/')
  ) {
    throw new Error('PDF and plain-text uploads are only allowed as attachments');
  }
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error('Upload size must be a positive safe integer');
  }
  const limit = uploadSizeLimit(normalized, options);
  if (contentLength > limit) {
    throw new Error(`Upload exceeds ${limit} byte limit`);
  }
}

/** Return effective byte ceiling for a MIME type and optional asset purpose. */
export function uploadSizeLimit(
  contentType: string,
  options: UploadValidationOptions = {},
): number {
  const normalized = normalizeContentType(contentType);
  if (!ALLOWED.has(normalized)) throw new Error(`Rejected content type: ${contentType}`);
  const maxBytes = optionOrDefault(options.maxBytes, DEFAULT_MAX_UPLOAD_BYTES);
  const maxImageBytes = optionOrDefault(options.maxImageBytes, DEFAULT_MAX_IMAGE_BYTES);
  const assetLimit =
    options.assetKind === undefined
      ? maxBytes
      : Math.min(maxBytes, ASSET_LIMITS[options.assetKind]);
  return Math.min(
    assetLimit,
    normalized.startsWith('image/') ? maxImageBytes : Number.MAX_SAFE_INTEGER,
  );
}

function startsWithBytes(body: Uint8Array, bytes: readonly number[]): boolean {
  if (body.length < bytes.length) return false;
  return bytes.every((value, index) => body[index] === value);
}

function hasExecutableSignature(body: Uint8Array): boolean {
  return (
    startsWithBytes(body, [0x4d, 0x5a]) ||
    startsWithBytes(body, [0x7f, 0x45, 0x4c, 0x46]) ||
    startsWithBytes(body, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWithBytes(body, [0xce, 0xfa, 0xed, 0xfe]) ||
    startsWithBytes(body, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWithBytes(body, [0xcf, 0xfa, 0xed, 0xfe])
  );
}

function hasArchiveSignature(body: Uint8Array): boolean {
  return (
    startsWithBytes(body, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(body, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(body, [0x50, 0x4b, 0x07, 0x08]) ||
    startsWithBytes(body, [0x1f, 0x8b]) ||
    startsWithBytes(body, [0x42, 0x5a, 0x68]) ||
    startsWithBytes(body, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) ||
    startsWithBytes(body, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) ||
    startsWithBytes(body, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) ||
    startsWithBytes(body, [0x4d, 0x53, 0x43, 0x46]) ||
    asciiAt(body, 0, '!<arch>') ||
    asciiAt(body, 257, 'ustar')
  );
}

function dangerousContainerReason(body: Uint8Array): string | null {
  if (hasExecutableSignature(body)) return 'Executable files are not allowed';
  if (hasArchiveSignature(body)) return 'Package archives are not allowed';
  return null;
}

function dangerousTextReason(body: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return null;
  }
  if (SHELL_SCRIPT.test(text) || PHP_SCRIPT.test(text) || WINDOWS_SCRIPT.test(text)) {
    return 'Scripts are not allowed';
  }
  if (DANGEROUS_HTML_TAGS.test(text)) return 'HTML is not allowed';
  return null;
}

function dangerousContentReason(
  contentType: AllowedContentType | null,
  body: Uint8Array,
): string | null {
  const containerReason = dangerousContainerReason(body);
  if (containerReason) return containerReason;
  if (contentType === 'text/plain') return dangerousTextReason(body);
  if (contentType === 'application/pdf') {
    const text = new TextDecoder().decode(body);
    if (!DANGEROUS_PDF_TOKENS.test(text)) return null;
    return /\/encrypt\b/i.test(text)
      ? 'Password-protected files are not allowed'
      : 'PDF contains an executable action';
  }
  return null;
}

function asciiAt(body: Uint8Array, offset: number, value: string): boolean {
  if (body.length < offset + value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (body[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function readUint16LE(body: Uint8Array, offset: number): number {
  return (body[offset] ?? 0) | ((body[offset + 1] ?? 0) << 8);
}

function readUint24LE(body: Uint8Array, offset: number): number {
  return readUint16LE(body, offset) | ((body[offset + 2] ?? 0) << 16);
}

function readUint32BE(body: Uint8Array, offset: number): number {
  return (
    (((body[offset] ?? 0) << 24) |
      ((body[offset + 1] ?? 0) << 16) |
      ((body[offset + 2] ?? 0) << 8) |
      (body[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint32LE(body: Uint8Array, offset: number): number {
  return (
    ((body[offset] ?? 0) |
      ((body[offset + 1] ?? 0) << 8) |
      ((body[offset + 2] ?? 0) << 16) |
      ((body[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function safeDimensions(width: number, height: number, options: UploadValidationOptions): boolean {
  const maxDimension = optionOrDefault(options.maxImageDimension, DEFAULT_MAX_IMAGE_DIMENSION);
  const maxPixels = optionOrDefault(options.maxImagePixels, DEFAULT_MAX_IMAGE_PIXELS);
  return (
    width > 0 &&
    height > 0 &&
    width <= maxDimension &&
    height <= maxDimension &&
    width * height <= maxPixels
  );
}

function pngDimensions(body: Uint8Array): [number, number] | null {
  if (!startsWithBytes(body, [137, 80, 78, 71, 13, 10, 26, 10]) || body.length < 33) return null;
  if (readUint32BE(body, 8) !== 13 || !asciiAt(body, 12, 'IHDR')) return null;
  return [readUint32BE(body, 16), readUint32BE(body, 20)];
}

function crc32(body: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc ^= body[index] ?? 0;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function hasValidPngStructure(body: Uint8Array): boolean {
  if (pngDimensions(body) === null) return false;
  let offset = 8;
  let hasIdat = false;
  while (offset + 12 <= body.length) {
    const length = readUint32BE(body, offset);
    const end = offset + 12 + length;
    if (end > body.length) return false;
    const typeBytes = body.slice(offset + 4, offset + 8);
    if (
      typeBytes.length !== 4 ||
      typeBytes.some((value) => !((value >= 65 && value <= 90) || (value >= 97 && value <= 122))) ||
      crc32(body, offset + 4, end - 4) !== readUint32BE(body, end - 4)
    )
      return false;
    const type = String.fromCharCode(...body.slice(offset + 4, offset + 8));
    if (type === 'IDAT') hasIdat = true;
    if (type === 'IEND') return hasIdat && end === body.length;
    offset = end;
  }
  return false;
}

function gifDimensions(body: Uint8Array): [number, number] | null {
  if (
    !(asciiAt(body, 0, 'GIF87a') || asciiAt(body, 0, 'GIF89a')) ||
    body.length < 11 ||
    body.at(-1) !== 0x3b
  ) {
    return null;
  }
  return [readUint16LE(body, 6), readUint16LE(body, 8)];
}

function jpegDimensions(body: Uint8Array): [number, number] | null {
  if (
    !startsWithBytes(body, [0xff, 0xd8]) ||
    body.length < 4 ||
    !startsWithBytes(body.slice(-2), [0xff, 0xd9])
  ) {
    return null;
  }
  let offset = 2;
  let dimensions: [number, number] | null = null;
  while (offset + 3 < body.length) {
    if (body[offset] !== 0xff) return null;
    while (body[offset] === 0xff) offset += 1;
    const marker = body[offset];
    offset += 1;
    if (marker === undefined) return null;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= body.length) return null;
    const segmentLength = (body[offset] ?? 0) * 256 + (body[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > body.length) return null;
    if (marker === 0xda) return dimensions;
    const isFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isFrame && segmentLength >= 7) {
      dimensions = [
        (body[offset + 3] ?? 0) * 256 + (body[offset + 4] ?? 0),
        (body[offset + 5] ?? 0) * 256 + (body[offset + 6] ?? 0),
      ];
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(body: Uint8Array): [number, number] | null {
  if (
    !asciiAt(body, 0, 'RIFF') ||
    !asciiAt(body, 8, 'WEBP') ||
    body.length < 30 ||
    readUint32LE(body, 4) + 8 > body.length
  ) {
    return null;
  }
  if (asciiAt(body, 12, 'VP8X')) {
    return [readUint24LE(body, 24) + 1, readUint24LE(body, 27) + 1];
  }
  if (asciiAt(body, 12, 'VP8 ') && body[23] === 0x9d && body[24] === 0x01 && body[25] === 0x2a) {
    return [readUint16LE(body, 26) & 0x3fff, readUint16LE(body, 28) & 0x3fff];
  }
  if (asciiAt(body, 12, 'VP8L') && body[20] === 0x2f && body.length >= 25) {
    const bits =
      (body[21] ?? 0) | ((body[22] ?? 0) << 8) | ((body[23] ?? 0) << 16) | ((body[24] ?? 0) << 24);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  return null;
}

function hasValidWebpStructure(body: Uint8Array): boolean {
  if (!asciiAt(body, 0, 'RIFF') || !asciiAt(body, 8, 'WEBP')) return false;
  const end = readUint32LE(body, 4) + 8;
  if (end !== body.length) return false;
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= end) {
    const size = readUint32LE(body, offset + 4);
    const chunkEnd = offset + 8 + size + (size % 2);
    if (chunkEnd > end) return false;
    const type = String.fromCharCode(...body.slice(offset, offset + 4));
    if (type === 'VP8 ' || type === 'VP8L' || type === 'ANMF') hasImageChunk = true;
    offset = chunkEnd;
  }
  return offset === end && hasImageChunk;
}

function isUtf8Text(body: Uint8Array): boolean {
  if (body.includes(0)) return false;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    return !/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
  } catch {
    return false;
  }
}

/** Identify bytes rather than trusting browser content-type headers. */
export function sniffContentType(body: Uint8Array): AllowedContentType | null {
  if (startsWithBytes(body, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWithBytes(body, [137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (asciiAt(body, 0, 'GIF87a') || asciiAt(body, 0, 'GIF89a')) return 'image/gif';
  if (asciiAt(body, 0, 'RIFF') && asciiAt(body, 8, 'WEBP')) return 'image/webp';
  if (asciiAt(body, 0, '%PDF-')) return 'application/pdf';
  if (isUtf8Text(body)) return 'text/plain';
  return null;
}

function imageDimensions(
  contentType: AllowedContentType,
  body: Uint8Array,
): [number, number] | null {
  switch (contentType) {
    case 'image/png':
      return pngDimensions(body);
    case 'image/gif':
      return gifDimensions(body);
    case 'image/jpeg':
      return jpegDimensions(body);
    case 'image/webp':
      return webpDimensions(body);
    default:
      return null;
  }
}

function copyBytes(body: Uint8Array): Uint8Array {
  return new Uint8Array(body);
}

function stripJpegMetadata(body: Uint8Array): Uint8Array {
  if (!startsWithBytes(body, [0xff, 0xd8])) return body;
  const output: number[] = [0xff, 0xd8];
  let offset = 2;
  while (offset + 3 < body.length) {
    if (body[offset] !== 0xff) return body;
    const markerStart = offset;
    while (body[offset] === 0xff) offset += 1;
    const marker = body[offset];
    offset += 1;
    if (marker === undefined) return body;
    if (marker === 0xda) {
      output.push(...body.slice(markerStart));
      return new Uint8Array(output);
    }
    if (marker === 0xd9 || marker === 0xd8) {
      output.push(0xff, marker);
      continue;
    }
    if (offset + 1 >= body.length) return body;
    const segmentLength = (body[offset] ?? 0) * 256 + (body[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > body.length) return body;
    const remove = marker !== 0xe0 && marker >= 0xe0 && marker <= 0xef;
    if (!remove && marker !== 0xfe) output.push(...body.slice(markerStart, offset + segmentLength));
    offset += segmentLength;
  }
  return body;
}

function pngWithoutAncillaryMetadata(body: Uint8Array): Uint8Array {
  if (!hasValidPngStructure(body)) return body;
  const metadataChunks = new Set(['eXIf', 'iCCP', 'iTXt', 'tEXt', 'tIME', 'zTXt']);
  const output: number[] = [...body.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= body.length) {
    const length = readUint32BE(body, offset);
    const end = offset + 12 + length;
    if (end > body.length) return body;
    const type = String.fromCharCode(...body.slice(offset + 4, offset + 8));
    const critical = (type.charCodeAt(0) & 32) === 0;
    if (critical || !metadataChunks.has(type)) output.push(...body.slice(offset, end));
    offset = end;
    if (type === 'IEND') return new Uint8Array(output);
  }
  return body;
}

function webpWithoutMetadata(body: Uint8Array): Uint8Array {
  if (!asciiAt(body, 0, 'RIFF') || !asciiAt(body, 8, 'WEBP')) return body;
  const chunks: Uint8Array[] = [];
  let offset = 12;
  while (offset + 8 <= body.length) {
    const size = readUint32LE(body, offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > body.length) return body;
    const type = String.fromCharCode(...body.slice(offset, offset + 4));
    if (type !== 'EXIF' && type !== 'XMP ' && type !== 'ICCP') chunks.push(body.slice(offset, end));
    offset = end;
  }
  if (offset !== body.length) return body;
  const totalSize = 4 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(8 + totalSize);
  output.set(new TextEncoder().encode('RIFFWEBP'), 0);
  new DataView(output.buffer).setUint32(4, totalSize, true);
  let target = 12;
  for (const chunk of chunks) {
    output.set(chunk, target);
    target += chunk.length;
  }
  return output;
}

function stripImageMetadata(contentType: AllowedContentType, body: Uint8Array): Uint8Array {
  switch (contentType) {
    case 'image/jpeg':
      return stripJpegMetadata(body);
    case 'image/png':
      return pngWithoutAncillaryMetadata(body);
    case 'image/webp':
      return webpWithoutMetadata(body);
    default:
      return copyBytes(body);
  }
}

/** Validate claimed and actual types, dimensions, size, and metadata-bearing image containers. */
export function validateUpload(
  body: Uint8Array,
  claimedContentType?: string,
  options: UploadValidationOptions = {},
): { ok: true; contentType: AllowedContentType; body: Uint8Array } | { ok: false; reason: string } {
  if (!(body instanceof Uint8Array) || body.length === 0)
    return { ok: false, reason: 'Upload is empty' };
  let maxBytes: number;
  try {
    maxBytes = optionOrDefault(options.maxBytes, DEFAULT_MAX_UPLOAD_BYTES);
    optionOrDefault(options.maxImageBytes, DEFAULT_MAX_IMAGE_BYTES);
    optionOrDefault(options.maxImagePixels, DEFAULT_MAX_IMAGE_PIXELS);
    optionOrDefault(options.maxImageDimension, DEFAULT_MAX_IMAGE_DIMENSION);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Upload limits are invalid',
    };
  }
  if (body.length > maxBytes) return { ok: false, reason: `Upload exceeds ${maxBytes} byte limit` };

  const preflightReason = dangerousContentReason(null, body);
  if (preflightReason) return { ok: false, reason: preflightReason };

  const actual = sniffContentType(body);
  if (!actual) return { ok: false, reason: 'File content type is not supported' };
  if (claimedContentType !== undefined) {
    let claimed: string;
    try {
      claimed = normalizeContentType(claimedContentType);
    } catch {
      return { ok: false, reason: 'Claimed content type is invalid' };
    }
    if (claimed !== actual)
      return { ok: false, reason: 'Claimed content type does not match file bytes' };
  }

  if (
    options.assetKind !== undefined &&
    options.assetKind !== 'attachment' &&
    !actual.startsWith('image/')
  ) {
    return { ok: false, reason: 'PDF and plain-text uploads are only allowed as attachments' };
  }

  try {
    assertUploadSize(actual, body.length, options);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Upload size is invalid' };
  }

  if (actual.startsWith('image/')) {
    const dimensions = imageDimensions(actual, body);
    const validContainer =
      actual === 'image/png'
        ? hasValidPngStructure(body)
        : actual === 'image/webp'
          ? hasValidWebpStructure(body)
          : true;
    if (!validContainer || !dimensions || !safeDimensions(dimensions[0], dimensions[1], options)) {
      return { ok: false, reason: 'Image dimensions are invalid or exceed the safety limit' };
    }
  }
  const contentReason = dangerousContentReason(actual, body);
  if (contentReason) return { ok: false, reason: contentReason };
  return {
    ok: true,
    contentType: actual,
    body: options.stripMetadata === false ? copyBytes(body) : stripImageMetadata(actual, body),
  };
}

export function extensionForContentType(contentType: string): string {
  const normalized = normalizeContentType(contentType);
  switch (normalized) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    case 'text/plain':
      return 'txt';
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}
