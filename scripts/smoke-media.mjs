#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  BUCKETS,
  S3StorageClient,
  assertBucketName,
  createQuarantineFlow,
  newUploadId,
  quarantineKey,
} from '../packages/storage/dist/index.js';

const require = createRequire(import.meta.url);
const sharp = require('../packages/storage/node_modules/sharp');
const endpoint = process.env.S3_ENDPOINT;
if (!endpoint) throw new Error('S3_ENDPOINT is required');

const storage = new S3StorageClient({
  endpoint,
  region: process.env.S3_REGION ?? 'auto',
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
});
const flow = createQuarantineFlow(storage);
const body = new Uint8Array(
  await sharp({
    create: { width: 4, height: 3, channels: 3, background: { r: 19, g: 83, b: 77 } },
  })
    .png()
    .toBuffer(),
);
const key = quarantineKey(newUploadId());
const promoted = [];

try {
  const upload = await flow.quarantinePut(key, {
    contentType: 'image/png',
    contentLength: body.length,
    assetKind: 'avatar',
  });
  const response = await fetch(upload.url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png', 'content-length': String(body.length) },
    body,
  });
  assert.equal(response.ok, true, `RustFS upload failed: ${response.status}`);

  const result = await flow.validateAndPromote(key, BUCKETS.publicMedia, body, undefined, {
    contentType: 'image/png',
    contentLength: body.length,
    assetKind: 'avatar',
  });
  promoted.push(result.targetKey, ...result.variants.map(({ targetKey }) => targetKey));
  assert.equal(result.variants.length, 2);
  for (const targetKey of promoted) {
    const signed = await storage.presignGet(BUCKETS.publicMedia, targetKey);
    const downloaded = await fetch(signed.url);
    assert.equal(downloaded.ok, true, `RustFS download failed: ${downloaded.status}`);
    assert.ok((await downloaded.arrayBuffer()).byteLength > 0);
  }

  assert.throws(() => assertBucketName('oss-backups'), /Unknown storage bucket/);
  await assert.rejects(
    storage.presignGet('oss-backups', 'not-an-app-object'),
    /Unknown storage bucket/,
  );
  console.log(`Media RustFS smoke passed (${result.variants.length} variants)`);
} finally {
  await Promise.all(
    promoted.map((targetKey) => storage.deleteObject(BUCKETS.publicMedia, targetKey)),
  );
  await storage.deleteObject(BUCKETS.quarantine, key);
}
