const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../logger');
const { requiereSesion } = require('../middleware/auth');
const { validarUsuario, publico } = require('../validacion');

const router = express.Router();
router.use(requiereSesion);

const idValido = (v) => /^\d+$/.test(String(v));

router.get('/', async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM users ORDER BY id');
    res.json(r.rows.map(publico));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'El id debe ser numérico' });
    const r = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(publico(r.rows[0]));
  } catch (e) { return next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const errores = validarUsuario(req.body || {});
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const { name, email, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), hash, role === 'admin' ? 'admin' : 'user'],
    );
    logger.info('usuario_creado', { userId: r.rows[0].id, por: req.usuario.sub });
    return res.status(201).json(publico(r.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
    return next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'El id debe ser numérico' });
    const errores = validarUsuario(req.body || {}, { passwordObligatoria: false });
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const { name, email, password, role } = req.body;
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const r = await db.query(
      `UPDATE users SET name = $1, email = $2, role = COALESCE($3, role),
         password_hash = COALESCE($4, password_hash), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), role === 'admin' || role === 'user' ? role : null, hash, req.params.id],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    logger.info('usuario_actualizado', { userId: r.rows[0].id, por: req.usuario.sub });
    return res.json(publico(r.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
    return next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'El id debe ser numérico' });
    if (String(req.usuario.sub) === String(req.params.id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    const r = await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    logger.info('usuario_eliminado', { userId: Number(req.params.id), por: req.usuario.sub });
    return res.status(204).end();
  } catch (e) { return next(e); }
});

module.exports = router;
