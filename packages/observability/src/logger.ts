import { trace, type Span, type Tracer } from '@opentelemetry/api';
import { redactBody, redactHeaders } from './redaction.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
};

function sanitizeFields(fields: LogFields | undefined): LogFields {
  if (!fields) return {};
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'headers' && typeof v === 'object' && v !== null) {
      out[k] = redactHeaders(v as Record<string, string | string[] | undefined>);
    } else {
      out[k] = redactBody(v);
    }
  }
  return out;
}

export function createLogger(service: string): Logger {
  const emit = (level: LogLevel, message: string, fields?: LogFields) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      service,
      message,
      ...sanitizeFields(fields),
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
  };
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

export function withSpan<T>(
  tracer: Tracer,
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          span.setAttribute(k, v);
        }
      }
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
