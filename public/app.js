// Funciones comunes del front: sesión en localStorage y llamadas a la API.
const Sesion = {
  token: () => localStorage.getItem('token'),
  usuario: () => JSON.parse(localStorage.getItem('usuario') || 'null'),
  guardar(token, usuario) { localStorage.setItem('token', token); localStorage.setItem('usuario', JSON.stringify(usuario)); },
  cerrar() { localStorage.removeItem('token'); localStorage.removeItem('usuario'); },
};

async function api(ruta, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Sesion.token()) headers.Authorization = `Bearer ${Sesion.token()}`;
  const r = await fetch(ruta, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const datos = r.status === 204 ? null : await r.json().catch(() => null);
  if (r.status === 401 && ruta !== '/api/auth/login') { Sesion.cerrar(); }
  if (!r.ok) throw new Error((datos && datos.error) || `Error ${r.status}`);
  return datos;
}

function mostrar(el, texto, tipo) {
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}
