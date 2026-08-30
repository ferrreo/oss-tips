import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { defaultResource, resourceFromAttributes, type Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

type Signal = 'metrics' | 'traces';

export type TelemetryConfig = {
  enabled: boolean;
  endpoint: string;
  tracesEndpoint: string;
  metricsEndpoint: string;
  headers: Record<string, string>;
  tracesHeaders: Record<string, string>;
  metricsHeaders: Record<string, string>;
  protocol: string;
  serviceName: string;
};

type TelemetryState = {
  started: boolean;
  sdk?: NodeSDK;
  shutdown?: Promise<void>;
};

const GLOBAL_STATE = '__ossTipsTelemetryState';
const globalState = (): TelemetryState => {
  const root = globalThis as typeof globalThis & { [GLOBAL_STATE]?: TelemetryState };
  return (root[GLOBAL_STATE] ??= { started: false });
};

function parseHeaders(value: string | undefined): Record<string, string> {
  if (!value) return {};
  return Object.fromEntries(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry): [string, string] => {
        const separator = entry.indexOf('=');
        if (separator < 1) return ['', ''];
        return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
      })
      .filter((entry): entry is [string, string] => entry[0].length > 0 && entry[1].length > 0),
  );
}

function signalEndpoint(endpoint: string, signal: Signal): string {
  try {
    const url = new URL(endpoint);
    if (url.pathname === '' || url.pathname === '/') url.pathname = `/v1/${signal}`;
    return url.toString();
  } catch {
    return '';
  }
}

function signalValue(
  env: NodeJS.ProcessEnv,
  signal: Signal,
  suffix: 'ENDPOINT' | 'HEADERS',
): string | undefined {
  const key = `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_${suffix}`;
  return env[key];
}

export function getTelemetryConfig(
  serviceName: string,
  env: NodeJS.ProcessEnv = process.env,
): TelemetryConfig {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() ?? '';
  const protocol = env.OTEL_EXPORTER_OTLP_PROTOCOL?.trim().toLowerCase() || 'http/protobuf';
  const tracesRaw = signalValue(env, 'traces', 'ENDPOINT')?.trim() || endpoint;
  const metricsRaw = signalValue(env, 'metrics', 'ENDPOINT')?.trim() || endpoint;
  const headers = parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);
  const tracesHeaders = parseHeaders(signalValue(env, 'traces', 'HEADERS'));
  const metricsHeaders = parseHeaders(signalValue(env, 'metrics', 'HEADERS'));
  const tracesEndpoint = signalEndpoint(tracesRaw, 'traces');
  const metricsEndpoint = signalEndpoint(metricsRaw, 'metrics');

  return {
    enabled:
      env.OTEL_SDK_DISABLED?.trim().toLowerCase() !== 'true' &&
      (endpoint.length > 0 || tracesRaw.length > 0 || metricsRaw.length > 0) &&
      protocol === 'http/protobuf' &&
      tracesEndpoint.length > 0 &&
      metricsEndpoint.length > 0,
    endpoint,
    tracesEndpoint,
    metricsEndpoint,
    headers,
    tracesHeaders,
    metricsHeaders,
    protocol,
    serviceName: env.OTEL_SERVICE_NAME?.trim() || serviceName,
  };
}

function resource(serviceName: string): Resource {
  return defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
    }),
  );
}

function exporterHeaders(
  common: Record<string, string>,
  signal: Record<string, string>,
): Record<string, string> {
  return { ...common, ...signal };
}

/**
 * Start Node's SDK only when an OTLP endpoint is configured. Export failures
 * stay inside the SDK and never make an application request fail.
 */
export function startTelemetry(serviceName: string, env: NodeJS.ProcessEnv = process.env): void {
  const state = globalState();
  if (state.started) return;
  state.started = true;

  const config = getTelemetryConfig(serviceName, env);
  if (!config.enabled) return;

  try {
    const traceExporter = new OTLPTraceExporter({
      url: config.tracesEndpoint,
      headers: exporterHeaders(config.headers, config.tracesHeaders),
    });
    const metricExporter = new OTLPMetricExporter({
      url: config.metricsEndpoint,
      headers: exporterHeaders(config.headers, config.metricsHeaders),
    });
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: Number(env.OTEL_METRIC_EXPORT_INTERVAL ?? 60_000),
      exportTimeoutMillis: Number(env.OTEL_EXPORTER_OTLP_TIMEOUT ?? 10_000),
    });

    const sdk = new NodeSDK({
      resource: resource(config.serviceName),
      traceExporter,
      metricReaders: [metricReader],
      instrumentations: [
        new HttpInstrumentation({
          headersToSpanAttributes: {
            client: { requestHeaders: [], responseHeaders: [] },
            server: { requestHeaders: [], responseHeaders: [] },
          },
          redactedQueryParams: [
            'sig',
            'Signature',
            'AWSAccessKeyId',
            'X-Goog-Signature',
            'token',
            'code',
            'state',
            'payment_id',
            'session_id',
          ],
        }),
        new PgInstrumentation({
          enhancedDatabaseReporting: false,
          ignoreConnectSpans: true,
        }),
      ],
    });
    sdk.start();
    state.sdk = sdk;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        service: config.serviceName,
        message: 'OpenTelemetry startup failed; continuing without telemetry',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function shutdownTelemetry(): Promise<void> {
  const state = globalState();
  if (!state.sdk) return;
  state.shutdown ??= state.sdk.shutdown().catch((error: unknown) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'OpenTelemetry shutdown failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
  await state.shutdown;
}
