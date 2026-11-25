const app = require('./app');
const db = require('./db');
const logger = require('./logger');
const { registrarTemperatura } = require('./metrics');

const PUERTO = Number(process.env.PORT || 3000);

async function arrancar(intentos = 20) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await db.inicializar();
      break;
    } catch (e) {
      logger.warn('esperando_base_de_datos', { intento: i, error: e.message });
      if (i === intentos) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  registrarTemperatura();
  app.listen(PUERTO, () => logger.info('servidor_iniciado', { puerto: PUERTO, version: process.env.APP_VERSION || 'dev' }));
}

process.on('unhandledRejection', (e) => logger.error('promesa_rechazada', { message: String(e && e.message), stack: e && e.stack }));
process.on('uncaughtException', (e) => { logger.error('excepcion_fatal', { message: e.message, stack: e.stack }); });

arrancar().catch((e) => { logger.error('no_se_pudo_iniciar', { message: e.message }); process.exit(1); });
