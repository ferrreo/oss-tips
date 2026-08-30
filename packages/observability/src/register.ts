import { startTelemetry } from './sdk.js';

startTelemetry(process.env.OTEL_SERVICE_NAME ?? '@oss-tips/node');
