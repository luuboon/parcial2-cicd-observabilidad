const jwt = require('jsonwebtoken');

const SECRETO = () => process.env.JWT_SECRET || 'secreto-de-desarrollo';

function firmar(usuario) {
  return jwt.sign({ sub: usuario.id, email: usuario.email, role: usuario.role }, SECRETO(), { expiresIn: '8h' });
}

function requiereSesion(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ error: 'Falta el token de sesión' });
  try {
    req.usuario = jwt.verify(token, SECRETO());
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
}

module.exports = { firmar, requiereSesion };
