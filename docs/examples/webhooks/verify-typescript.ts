import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

interface SignatureVector {
  secret: string;
  timestamp: string;
  body: string;
  signed_bytes: string;
  signature: string;
}

const vector = JSON.parse(
  readFileSync(new URL('./signature-vector.json', import.meta.url), 'utf8'),
) as SignatureVector;
const signedBytes = `${vector.timestamp}.${vector.body}`;
if (signedBytes !== vector.signed_bytes) throw new Error('signed bytes do not match vector');

const expected = `v1=${createHmac('sha256', vector.secret).update(signedBytes).digest('hex')}`;
const expectedBytes = Buffer.from(expected);
const receivedBytes = Buffer.from(vector.signature);
const valid =
  expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);

if (!valid) throw new Error('webhook signature did not verify');
console.log(valid);
