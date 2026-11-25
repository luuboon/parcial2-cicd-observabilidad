// Logs estructurados: se imprimen en consola (JSON) y se emiten como log records de OpenTelemetry.
const { logs, SeverityNumber } = require('@opentelemetry/api');

const otelLogger = logs.getLogger('parcial2-api');
const NIVELES = {
  debug: SeverityNumber.DEBUG, info: SeverityNumber.INFO, warn: SeverityNumber.WARN, error: SeverityNumber.ERROR,
};

function log(nivel, mensaje, atributos = {}) {
  const registro = { timestamp: new Date().toISOString(), level: nivel, message: mensaje, ...atributos };
  if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify(registro));
  otelLogger.emit({
    severityNumber: NIVELES[nivel] ?? SeverityNumber.INFO,
    severityText: nivel.toUpperCase(),
    body: mensaje,
    attributes: atributos,
  });
}

module.exports = {
  debug: (m, a) => log('debug', m, a),
  info: (m, a) => log('info', m, a),
  warn: (m, a) => log('warn', m, a),
  error: (m, a) => log('error', m, a),
};
