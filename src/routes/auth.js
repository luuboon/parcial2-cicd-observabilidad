const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../logger');
const { firmar, requiereSesion } = require('../middleware/auth');
const { validarUsuario, publico } = require('../validacion');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const errores = validarUsuario(req.body || {});
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), hash],
    );
    logger.info('usuario_registrado', { userId: r.rows[0].id });
    return res.status(201).json({ token: firmar(r.rows[0]), user: publico(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
    return next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    const r = await db.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(String(password), u.password_hash))) {
      logger.warn('login_fallido', { email: String(email) });
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    logger.info('login_exitoso', { userId: u.id });
    return res.json({ token: firmar(u), user: publico(u) });
  } catch (e) { return next(e); }
});

router.get('/me', requiereSesion, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM users WHERE id = $1', [req.usuario.sub]);
    if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(publico(r.rows[0]));
  } catch (e) { return next(e); }
});

module.exports = router;
