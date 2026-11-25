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
// Webhook interno para las alertas de OpenObserve. NGINX no lo publica (solo se alcanza dentro de la red de Docker);
// cada alerta queda como log estructurado y viaja de regreso a OpenObserve por OTLP.
app.post('/api/interno/alertas', (req, res) => {
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
  logger.error('excepcion_no_controlada', { message: err.message, stack: err.stack, path: req.originalUrl, method: req.method });
  return res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
