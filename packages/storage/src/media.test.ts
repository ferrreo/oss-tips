import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processImage } from './media.js';

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
);

describe('decoded media processing', () => {
  it('re-encodes images and creates stable responsive variants', async () => {
    const first = await processImage(ONE_PIXEL_PNG, 'image/png', 'avatar');
    const second = await processImage(ONE_PIXEL_PNG, 'image/png', 'avatar');
    expect(first?.contentType).toBe('image/png');
    expect(first?.body).not.toEqual(ONE_PIXEL_PNG);
    expect(first?.variants.map(({ name }) => name)).toEqual(['sm', 'md']);
    expect(first?.variants).toEqual(second?.variants);
    for (const variant of first?.variants ?? []) {
      const metadata = await sharp(variant.body).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(1);
      expect(metadata.height).toBe(1);
    }
  });

  it('applies orientation and strips metadata while preserving attachment bytes policy', async () => {
    const oriented = new Uint8Array(
      await sharp({
        create: { width: 2, height: 1, channels: 3, background: { r: 20, g: 40, b: 60 } },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer(),
    );
    const processed = await processImage(oriented, 'image/jpeg', 'post_image');
    expect(processed?.width).toBe(1);
    expect(processed?.height).toBe(2);
    expect((await sharp(processed?.body).metadata()).orientation).toBeUndefined();

    const attachment = await processImage(ONE_PIXEL_PNG, 'image/png', 'attachment');
    expect(attachment?.variants).toEqual([]);
  });

  it('rejects malformed input and decoded pixel bombs', async () => {
    await expect(processImage(ONE_PIXEL_PNG.slice(0, 33), 'image/png', 'logo')).rejects.toThrow();
    const twoPixels = new Uint8Array(
      await sharp({
        create: { width: 2, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .png()
        .toBuffer(),
    );
    await expect(
      processImage(twoPixels, 'image/png', 'logo', { maxImagePixels: 1 }),
    ).rejects.toThrow();
  });
});
