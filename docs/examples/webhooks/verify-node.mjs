import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = 'whsec_test_vector_32bytes_minimum';
const timestamp = '1787947200';
const body =
  '{"id":"evt_01JTEST","type":"project.updated","api_version":"2026-08-01","created_at":"2026-08-28T20:00:00Z","project_id":"prj_01JTEST","data":{"object":{"name":"Grove"}}}';
const expected = `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
const received = 'v1=c4a0a5507fb568805feccffcf4a6909fea055f96e67fa4b37b7c2a9c819bb7bf';
const expectedBytes = Buffer.from(expected);
const receivedBytes = Buffer.from(received);
const valid =
  expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);

if (!valid) throw new Error('webhook signature did not verify');
console.log(valid);
