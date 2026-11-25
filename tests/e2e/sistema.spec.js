// Pruebas E2E: login, registro y CRUD de usuarios desde la interfaz.
const { test, expect } = require('@playwright/test');

const ADMIN = { email: 'admin@uteq.edu.mx', password: 'Admin123!' };
const unico = (pre) => `${pre}.${Date.now()}${Math.floor(Math.random() * 1000)}@uteq.edu.mx`;

async function entrar(page, { email, password } = ADMIN) {
  await page.goto('/');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/users\.html$/);
}

async function crearUsuario(page, { nombre, email, password = 'Secreta123', rol = 'user' }) {
  await page.getByTestId('usuario-nombre').fill(nombre);
  await page.getByTestId('usuario-email').fill(email);
  await page.getByTestId('usuario-password').fill(password);
  await page.getByTestId('usuario-rol').selectOption(rol);
  await page.getByTestId('usuario-guardar').click();
}

test.describe('Login', () => {
  test('La página de login muestra sus campos', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
    await expect(page.getByTestId('login-submit')).toHaveText('Entrar');
  });
  test('Sin datos muestra un aviso', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-mensaje')).toHaveText('Escribe tu correo y tu contraseña');
  });
  test('Con contraseña incorrecta muestra error y no entra', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-email').fill(ADMIN.email);
    await page.getByTestId('login-password').fill('incorrecta');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-mensaje')).toHaveText('Correo o contraseña incorrectos');
    await expect(page).not.toHaveURL(/users\.html$/);
  });
  test('Con datos correctos entra a la gestión de usuarios', async ({ page }) => {
    await entrar(page);
    await expect(page.getByRole('heading', { name: 'Gestión de usuarios' })).toBeVisible();
    await expect(page.getByTestId('usuario-actual')).toHaveText(ADMIN.email);
  });
  test('El enlace "Regístrate" lleva al registro', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('link-registro').click();
    await expect(page).toHaveURL(/register\.html$/);
  });
});

test.describe('Registro', () => {
  test('La página de registro muestra sus campos', async ({ page }) => {
    await page.goto('/register.html');
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    for (const id of ['registro-nombre', 'registro-email', 'registro-password', 'registro-password2']) await expect(page.getByTestId(id)).toBeVisible();
  });
  test('Avisa si las contraseñas no coinciden', async ({ page }) => {
    await page.goto('/register.html');
    await page.getByTestId('registro-nombre').fill('Prueba');
    await page.getByTestId('registro-email').fill(unico('dif'));
    await page.getByTestId('registro-password').fill('Secreta123');
    await page.getByTestId('registro-password2').fill('Otra12345');
    await page.getByTestId('registro-submit').click();
    await expect(page.getByTestId('registro-mensaje')).toHaveText('Las contraseñas no coinciden');
  });
  test('Muestra el error de contraseña corta que manda la API', async ({ page }) => {
    await page.goto('/register.html');
    await page.getByTestId('registro-nombre').fill('Prueba');
    await page.getByTestId('registro-email').fill(unico('corta'));
    await page.getByTestId('registro-password').fill('123');
    await page.getByTestId('registro-password2').fill('123');
    await page.getByTestId('registro-submit').click();
    await expect(page.getByTestId('registro-mensaje')).toContainText('al menos 8 caracteres');
  });
  test('No deja registrar un correo que ya existe', async ({ page }) => {
    await page.goto('/register.html');
    await page.getByTestId('registro-nombre').fill('Duplicado');
    await page.getByTestId('registro-email').fill(ADMIN.email);
    await page.getByTestId('registro-password').fill('Secreta123');
    await page.getByTestId('registro-password2').fill('Secreta123');
    await page.getByTestId('registro-submit').click();
    await expect(page.getByTestId('registro-mensaje')).toHaveText('Ese correo ya está registrado');
  });
  test('Un registro correcto entra directo al sistema', async ({ page }) => {
    const email = unico('nuevo');
    await page.goto('/register.html');
    await page.getByTestId('registro-nombre').fill('Usuario Nuevo');
    await page.getByTestId('registro-email').fill(email);
    await page.getByTestId('registro-password').fill('Secreta123');
    await page.getByTestId('registro-password2').fill('Secreta123');
    await page.getByTestId('registro-submit').click();
    await expect(page).toHaveURL(/users\.html$/);
    await expect(page.getByTestId('usuario-actual')).toHaveText(email);
  });
  test('Después de registrarse puede iniciar sesión', async ({ page }) => {
    const email = unico('relogin');
    await page.goto('/register.html');
    await page.getByTestId('registro-nombre').fill('Relogin');
    await page.getByTestId('registro-email').fill(email);
    await page.getByTestId('registro-password').fill('Secreta123');
    await page.getByTestId('registro-password2').fill('Secreta123');
    await page.getByTestId('registro-submit').click();
    await page.getByTestId('logout').click();
    await entrar(page, { email, password: 'Secreta123' });
  });
});

test.describe('CRUD de usuarios', () => {
  test.beforeEach(async ({ page }) => { await entrar(page); });

  test('La tabla lista al administrador', async ({ page }) => {
    await expect(page.getByTestId(`fila-${ADMIN.email}`)).toContainText('admin');
  });
  test('Crear un usuario lo agrega a la tabla', async ({ page }) => {
    const email = unico('crear');
    await crearUsuario(page, { nombre: 'Creado Desde UI', email });
    await expect(page.getByTestId('usuarios-mensaje')).toHaveText('Usuario creado');
    await expect(page.getByTestId(`fila-${email}`)).toContainText('Creado Desde UI');
  });
  test('Crear un usuario admin guarda el rol', async ({ page }) => {
    const email = unico('admin');
    await crearUsuario(page, { nombre: 'Otro Admin', email, rol: 'admin' });
    await expect(page.getByTestId(`fila-${email}`)).toContainText('admin');
  });
  test('Crear con datos inválidos muestra el error', async ({ page }) => {
    await crearUsuario(page, { nombre: 'X', email: 'sin-arroba', password: '1' });
    await expect(page.getByTestId('usuarios-mensaje')).toContainText('El nombre debe tener al menos 2 caracteres');
  });
  test('El contador de usuarios aumenta al crear', async ({ page }) => {
    const antes = parseInt(await page.getByTestId('usuarios-total').textContent(), 10);
    await crearUsuario(page, { nombre: 'Contador', email: unico('contador') });
    await expect(page.getByTestId('usuarios-total')).toHaveText(`${antes + 1} usuario(s)`);
  });
  test('Editar cambia el nombre en la tabla', async ({ page }) => {
    const email = unico('editar');
    await crearUsuario(page, { nombre: 'Antes', email });
    await page.getByTestId(`fila-${email}`).getByTestId('editar').click();
    await expect(page.getByTestId('form-titulo')).toContainText('Editar usuario');
    await page.getByTestId('usuario-nombre').fill('Después');
    await page.getByTestId('usuario-guardar').click();
    await expect(page.getByTestId('usuarios-mensaje')).toHaveText('Usuario actualizado');
    await expect(page.getByTestId(`fila-${email}`)).toContainText('Después');
  });
  test('Editar el rol a admin', async ({ page }) => {
    const email = unico('rol');
    await crearUsuario(page, { nombre: 'Cambio Rol', email });
    await page.getByTestId(`fila-${email}`).getByTestId('editar').click();
    await page.getByTestId('usuario-rol').selectOption('admin');
    await page.getByTestId('usuario-guardar').click();
    await expect(page.getByTestId(`fila-${email}`)).toContainText('admin');
  });
  test('Cancelar la edición limpia el formulario', async ({ page }) => {
    await page.getByTestId(`fila-${ADMIN.email}`).getByTestId('editar').click();
    await expect(page.getByTestId('usuario-email')).toHaveValue(ADMIN.email);
    await page.getByTestId('usuario-cancelar').click();
    await expect(page.getByTestId('usuario-email')).toHaveValue('');
    await expect(page.getByTestId('form-titulo')).toHaveText('Nuevo usuario');
  });
  test('Eliminar un usuario lo quita de la tabla', async ({ page }) => {
    const email = unico('borrar');
    await crearUsuario(page, { nombre: 'Para Borrar', email });
    page.once('dialog', (d) => d.accept());
    await page.getByTestId(`fila-${email}`).getByTestId('eliminar').click();
    await expect(page.getByTestId('usuarios-mensaje')).toHaveText('Usuario eliminado');
    await expect(page.getByTestId(`fila-${email}`)).toHaveCount(0);
  });
  test('Si se cancela la confirmación, el usuario se queda', async ({ page }) => {
    const email = unico('quedarse');
    await crearUsuario(page, { nombre: 'Se Queda', email });
    page.once('dialog', (d) => d.dismiss());
    await page.getByTestId(`fila-${email}`).getByTestId('eliminar').click();
    await expect(page.getByTestId(`fila-${email}`)).toHaveCount(1);
  });
  test('No permite eliminar la propia cuenta', async ({ page }) => {
    page.once('dialog', (d) => d.accept());
    await page.getByTestId(`fila-${ADMIN.email}`).getByTestId('eliminar').click();
    await expect(page.getByTestId('usuarios-mensaje')).toHaveText('No puedes eliminar tu propia cuenta');
  });
  test('Cerrar sesión regresa al login', async ({ page }) => {
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/index\.html$/);
  });
});

test.describe('Protección de rutas', () => {
  test('Sin sesión, users.html manda al login', async ({ page }) => {
    await page.goto('/users.html');
    await expect(page).toHaveURL(/index\.html$/);
  });
  test('Con sesión, el login manda a users.html', async ({ page }) => {
    await entrar(page);
    await page.goto('/');
    await expect(page).toHaveURL(/users\.html$/);
  });
  test('Un token vencido o falso regresa al login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { localStorage.setItem('token', 'token.falso.123'); localStorage.setItem('usuario', '{"email":"x"}'); });
    await page.goto('/users.html');
    await expect(page).toHaveURL(/index\.html$/);
  });
  test('La API responde salud correcta', async ({ request }) => {
    const r = await request.get('/api/health');
    expect(r.status()).toBe(200);
    expect((await r.json()).db).toBe('ok');
  });
});
