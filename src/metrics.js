// Métricas propias de la aplicación (además de las automáticas de http):
// peticiones por endpoint, latencia, errores HTTP y temperatura del host (si existe el sensor).
const fs = require('fs');
const path = require('path');
const { metrics } = require('@opentelemetry/api');
const logger = require('./logger');

const meter = metrics.getMeter('parcial2-api');

const peticiones = meter.createCounter('http_requests_total', { description: 'Peticiones HTTP por método, ruta y código de estado' });
const errores = meter.createCounter('http_errors_total', { description: 'Respuestas HTTP con código 4xx o 5xx' });
const latencia = meter.createHistogram('http_request_duration_ms', { description: 'Tiempo de respuesta en milisegundos', unit: 'ms' });

/** Middleware: mide cada petición y escribe un log estructurado con statusCode, latencia y timestamp. */
function medirPeticiones(req, res, next) {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const ruta = req.route ? `${req.baseUrl}${req.route.path}`
      : req.baseUrl && req.baseUrl !== '/api' ? req.baseUrl
        : req.originalUrl.startsWith('/api') ? 'no_encontrada' : 'estatico';
    const atributos = { 'http.method': req.method, 'http.route': ruta, 'http.status_code': res.statusCode };
    peticiones.add(1, atributos);
    latencia.record(ms, atributos);
    if (res.statusCode >= 400) errores.add(1, atributos);
    if (req.path.startsWith('/api')) {
      logger.info('peticion_http', {
        method: req.method, route: ruta, path: req.originalUrl, statusCode: res.statusCode,
        latency_ms: Math.round(ms * 100) / 100, timestamp: new Date().toISOString(),
      });
    }
  });
  next();
}

/** Temperatura del host: AWS EC2 normalmente no expone sensores térmicos; si no hay, se registra una sola vez. */
function registrarTemperatura() {
  const base = process.env.HOST_SYS_PATH || '/sys';
  const zonas = path.join(base, 'class', 'thermal');
  let avisado = false;
  meter.createObservableGauge('host_temperature_celsius', { description: 'Temperatura del host leída de /sys/class/thermal', unit: 'Cel' })
    .addCallback((obs) => {
      let leidas = 0;
      try {
        for (const z of fs.readdirSync(zonas).filter((n) => n.startsWith('thermal_zone'))) {
          const v = Number(fs.readFileSync(path.join(zonas, z, 'temp'), 'utf8')) / 1000;
          if (Number.isFinite(v)) { obs.observe(v, { zone: z }); leidas++; }
        }
      } catch { /* sin sensores */ }
      if (!leidas && !avisado) {
        avisado = true;
        logger.warn('sensor_temperatura_no_disponible', { detalle: `No hay zonas térmicas en ${zonas}; las instancias virtuales de EC2 no exponen la temperatura del hardware.` });
      }
    });
}

module.exports = { medirPeticiones, registrarTemperatura };
