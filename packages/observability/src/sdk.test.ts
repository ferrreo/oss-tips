import { describe, expect, it } from 'vitest';
import { getTelemetryConfig } from './sdk.js';

describe('telemetry configuration', () => {
  it('stays disabled until an OTLP HTTP endpoint is configured', () => {
    expect(getTelemetryConfig('@oss-tips/test', {})).toMatchObject({
      enabled: false,
      serviceName: '@oss-tips/test',
    });
  });

  it('maps a shared collector endpoint to signal endpoints and headers', () => {
    const config = getTelemetryConfig('@oss-tips/test', {
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
      OTEL_EXPORTER_OTLP_HEADERS: 'x-tenant=oss-tips,Authorization=Bearer common',
      OTEL_EXPORTER_OTLP_TRACES_HEADERS: 'Authorization=Bearer traces',
      OTEL_SERVICE_NAME: '@oss-tips/test-override',
    });

    expect(config).toMatchObject({
      enabled: true,
      serviceName: '@oss-tips/test-override',
      tracesEndpoint: 'http://collector:4318/v1/traces',
      metricsEndpoint: 'http://collector:4318/v1/metrics',
      headers: { 'x-tenant': 'oss-tips', Authorization: 'Bearer common' },
      tracesHeaders: { Authorization: 'Bearer traces' },
    });
  });

  it('rejects unsupported protocols and explicit SDK disablement', () => {
    expect(
      getTelemetryConfig('@oss-tips/test', {
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
      }).enabled,
    ).toBe(false);
    expect(
      getTelemetryConfig('@oss-tips/test', {
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_SDK_DISABLED: 'true',
      }).enabled,
    ).toBe(false);
  });
});
