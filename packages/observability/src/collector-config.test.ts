import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const collectorConfig = readFileSync(
  fileURLToPath(new URL('../../../infra/otel/collector.yaml', import.meta.url)),
  'utf8',
);

describe('collector configuration', () => {
  it('keeps OTLP ingress local to the collector and exports through Maple env vars', () => {
    expect(collectorConfig).toContain('receivers:');
    expect(collectorConfig).toContain('endpoint: 0.0.0.0:4318');
    expect(collectorConfig).toContain('endpoint: ${env:MAPLE_OTLP_ENDPOINT}');
    expect(collectorConfig).toContain('MAPLE_OTLP_TOKEN');
  });

  it('deletes bodies, credentials, query strings, and identifying fields', () => {
    for (const field of [
      'http.request.header.authorization',
      'http.request.header.cookie',
      'url.query',
      'http.request.body',
      'http.response.body',
      'db.query.text',
      'payment.id',
      'project.id',
      'user.email',
    ]) {
      expect(collectorConfig).toContain(`key: ${field}`);
    }
    expect(collectorConfig).not.toMatch(/sk_(?:live|test)_[A-Za-z0-9]+/);
    expect(collectorConfig).not.toMatch(/whsec_[A-Za-z0-9]+/);
  });
});
