const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validarUsuario({ name, email, password }, { passwordObligatoria = true } = {}) {
  const errores = [];
  if (typeof name !== 'string' || name.trim().length < 2) errores.push('El nombre debe tener al menos 2 caracteres');
  if (typeof email !== 'string' || !CORREO.test(email.trim())) errores.push('El correo no es válido');
  if (passwordObligatoria || password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres');
  }
  return errores;
}

const publico = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at, updated_at: u.updated_at });

module.exports = { validarUsuario, publico };
