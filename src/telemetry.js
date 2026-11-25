// Instrumentación OpenTelemetry (OTLP/HTTP): trazas, métricas y logs.
// Se carga antes que la app (node --require ./src/telemetry.js) para que las librerías
// http, express y pg queden instrumentadas automáticamente.
// Los datos van al OpenTelemetry Collector (OTEL_EXPORTER_OTLP_ENDPOINT), que los reenvía a OpenObserve.
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { resourceFromAttributes } = require('@opentelemetry/resources');

const activo = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) && process.env.OTEL_SDK_DISABLED !== 'true';

if (activo) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'parcial2-api',
      'service.version': process.env.APP_VERSION || 'dev',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 15000 }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });
  sdk.start();
  const cerrar = () => sdk.shutdown().catch(() => {}).finally(() => process.exit(0));
  process.on('SIGTERM', cerrar);
  process.on('SIGINT', cerrar);
}

module.exports = { activo };
