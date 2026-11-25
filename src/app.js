const path = require('path');
const express = require('express');
const db = require('./db');
const logger = require('./logger');
const { medirPeticiones } = require('./metrics');

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(medirPeticiones);

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), version: process.env.APP_VERSION || 'dev' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'sin conexión', timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
// Webhook que recibe las alertas de OpenObserve. OpenObserve no permite destinos en IPs privadas,
// así que llama a la IP pública del servidor. Solo deja un log estructurado (no toca datos) y ese log
// regresa a OpenObserve por OTLP, donde se ve junto con el resto de eventos.
app.post('/api/alertas/webhook', (req, res) => {
  const cuerpo = req.body || {};
  logger.warn('alerta_openobserve', {
    alerta: String(cuerpo.alerta || cuerpo.alert_name || 'desconocida').slice(0, 200),
    detalle: JSON.stringify(cuerpo).slice(0, 2000),
  });
  res.status(202).json({ recibida: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Manejo central de errores: se registra la excepción como log de nivel error (también queda en la traza).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  // Errores del cliente que lanza Express (cuerpo demasiado grande, codificación no soportada, ...):
  // se responden con su propio código y no cuentan como excepción del servidor.
  const codigo = err.status || err.statusCode;
  if (codigo >= 400 && codigo < 500) {
    logger.warn('peticion_rechazada', { motivo: err.type || err.message, statusCode: codigo, path: req.originalUrl });
    return res.status(codigo).json({ error: codigo === 413 ? 'El cuerpo de la petición es demasiado grande' : 'Petición inválida' });
  }
  logger.error('excepcion_no_controlada', { message: err.message, stack: err.stack, path: req.originalUrl, method: req.method });
  return res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
