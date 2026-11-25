// Pruebas de backend con Jest + Supertest contra una base PostgreSQL real (servicio en GitHub Actions).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/parcial2_test';
process.env.JWT_SECRET = 'secreto-pruebas';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');

const ADMIN = { email: 'admin@uteq.edu.mx', password: 'Admin123!' };
let token;

beforeAll(async () => {
  await db.inicializar();
  await db.query('DELETE FROM users WHERE email <> $1', [ADMIN.email]);
  const r = await request(app).post('/api/auth/login').send(ADMIN);
  token = r.body.token;
});
afterAll(async () => { await db.pool.end(); });

const conToken = (req) => req.set('Authorization', `Bearer ${token}`);

describe('Salud y rutas generales', () => {
  test('GET /api/health responde ok con la base conectada', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(new Date(r.body.timestamp).toString()).not.toBe('Invalid Date');
  });
  test('Una ruta /api inexistente responde 404 en JSON', async () => {
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Endpoint no encontrado');
  });
  test('Sirve el front (login) en /', async () => {
    const r = await request(app).get('/');
    expect(r.status).toBe(200);
    expect(r.text).toContain('Iniciar sesión');
  });
  test('Un JSON mal formado responde 400', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(r.status).toBe(400);
  });
});

describe('Registro', () => {
  test('Registra un usuario nuevo y devuelve token', async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'Ana Pruebas', email: 'ana@uteq.edu.mx', password: 'Secreta123' });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user).toMatchObject({ name: 'Ana Pruebas', email: 'ana@uteq.edu.mx', role: 'user' });
    expect(r.body.user.password_hash).toBeUndefined();
  });
  test('No permite registrar un correo repetido (409)', async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'Otra Ana', email: 'ana@uteq.edu.mx', password: 'Secreta123' });
    expect(r.status).toBe(409);
  });
  test.each([
    [{ name: 'A', email: 'a@uteq.edu.mx', password: 'Secreta123' }, 'nombre'],
    [{ name: 'Beto', email: 'beto-sin-arroba', password: 'Secreta123' }, 'correo'],
    [{ name: 'Beto', email: 'beto@uteq.edu.mx', password: '123' }, 'contraseña'],
    [{}, 'nombre'],
  ])('Valida los datos del registro (%o)', async (datos, palabra) => {
    const r = await request(app).post('/api/auth/register').send(datos);
    expect(r.status).toBe(400);
    expect(r.body.error).toContain(palabra);
  });
});

describe('Login y sesión', () => {
  test('Login correcto devuelve token y usuario', async () => {
    const r = await request(app).post('/api/auth/login').send(ADMIN);
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('admin');
  });
  test('Contraseña incorrecta responde 401', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'mala' });
    expect(r.status).toBe(401);
  });
  test('Correo inexistente responde 401', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'nadie@uteq.edu.mx', password: 'Secreta123' });
    expect(r.status).toBe(401);
  });
  test('Login sin datos responde 400', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });
  test('GET /api/auth/me devuelve al usuario de la sesión', async () => {
    const r = await conToken(request(app).get('/api/auth/me'));
    expect(r.status).toBe(200);
    expect(r.body.email).toBe(ADMIN.email);
  });
  test('Sin token, /api/auth/me responde 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
  test('Con un token inválido responde 401', async () => {
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
  });
});

describe('CRUD de usuarios', () => {
  let creado;
  test('Listar usuarios exige sesión', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
  test('Crear usuario (201)', async () => {
    const r = await conToken(request(app).post('/api/users')).send({ name: 'Carlos CRUD', email: 'carlos@uteq.edu.mx', password: 'Secreta123' });
    expect(r.status).toBe(201);
    creado = r.body;
    expect(creado.id).toBeGreaterThan(0);
  });
  test('Crear con datos inválidos responde 400', async () => {
    const r = await conToken(request(app).post('/api/users')).send({ name: 'X', email: 'mal', password: '1' });
    expect(r.status).toBe(400);
  });
  test('Crear con correo repetido responde 409', async () => {
    const r = await conToken(request(app).post('/api/users')).send({ name: 'Carlos Dos', email: 'carlos@uteq.edu.mx', password: 'Secreta123' });
    expect(r.status).toBe(409);
  });
  test('Listar incluye al usuario creado', async () => {
    const r = await conToken(request(app).get('/api/users'));
    expect(r.status).toBe(200);
    expect(r.body.map((u) => u.email)).toContain('carlos@uteq.edu.mx');
  });
  test('Obtener por id', async () => {
    const r = await conToken(request(app).get(`/api/users/${creado.id}`));
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Carlos CRUD');
  });
  test('Obtener un id inexistente responde 404', async () => {
    expect((await conToken(request(app).get('/api/users/999999'))).status).toBe(404);
  });
  test('Un id no numérico responde 400', async () => {
    expect((await conToken(request(app).get('/api/users/abc'))).status).toBe(400);
  });
  test('Actualizar nombre y rol', async () => {
    const r = await conToken(request(app).put(`/api/users/${creado.id}`)).send({ name: 'Carlos Editado', email: 'carlos@uteq.edu.mx', role: 'admin' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: 'Carlos Editado', role: 'admin' });
  });
  test('Actualizar la contraseña permite entrar con la nueva', async () => {
    await conToken(request(app).put(`/api/users/${creado.id}`)).send({ name: 'Carlos Editado', email: 'carlos@uteq.edu.mx', password: 'NuevaClave99' });
    const r = await request(app).post('/api/auth/login').send({ email: 'carlos@uteq.edu.mx', password: 'NuevaClave99' });
    expect(r.status).toBe(200);
  });
  test('Actualizar con el correo de otro usuario responde 409', async () => {
    const r = await conToken(request(app).put(`/api/users/${creado.id}`)).send({ name: 'Carlos', email: 'ana@uteq.edu.mx' });
    expect(r.status).toBe(409);
  });
  test('Actualizar un id inexistente responde 404', async () => {
    const r = await conToken(request(app).put('/api/users/999999')).send({ name: 'Nadie', email: 'nadie@uteq.edu.mx' });
    expect(r.status).toBe(404);
  });
  test('No se puede eliminar la propia cuenta', async () => {
    const yo = await conToken(request(app).get('/api/auth/me'));
    expect((await conToken(request(app).delete(`/api/users/${yo.body.id}`))).status).toBe(400);
  });
  test('Eliminar usuario (204) y ya no existe', async () => {
    expect((await conToken(request(app).delete(`/api/users/${creado.id}`))).status).toBe(204);
    expect((await conToken(request(app).get(`/api/users/${creado.id}`))).status).toBe(404);
  });
  test('Eliminar un id inexistente responde 404', async () => {
    expect((await conToken(request(app).delete('/api/users/999999'))).status).toBe(404);
  });
});

describe('Webhook interno de alertas', () => {
  test('Recibe una alerta de OpenObserve y responde 202', async () => {
    const r = await request(app).post('/api/interno/alertas').send({ alerta: 'Errores HTTP 5xx', valor: 3 });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ recibida: true });
  });
});
