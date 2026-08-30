import { BOOTSTRAP_BUCKETS } from './types.js';
import { createStorageClient } from './quarantine.js';
import { S3StorageClient } from './s3-storage.js';

const endpoint = process.env.S3_ENDPOINT;
if (!endpoint) throw new Error('S3_ENDPOINT is required');

const storage = createStorageClient({
  s3Endpoint: endpoint,
  s3Region: process.env.S3_REGION ?? 'auto',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});
if (!(storage instanceof S3StorageClient)) throw new Error('S3 storage is required');

await storage.ensureBuckets();
console.log(`Storage buckets ready: ${BOOTSTRAP_BUCKETS.join(', ')}`);
