// Acceso a PostgreSQL. La instrumentación de pg crea una traza por cada consulta.
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/parcial2' });

async function inicializar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  const correo = process.env.ADMIN_EMAIL || 'admin@uteq.edu.mx';
  const existe = await pool.query('SELECT 1 FROM users WHERE email = $1', [correo]);
  if (!existe.rowCount) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
    await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", ['Administrador', correo, hash]);
    logger.info('usuario_admin_creado', { email: correo });
  }
}

module.exports = { pool, inicializar, query: (text, params) => pool.query(text, params) };
