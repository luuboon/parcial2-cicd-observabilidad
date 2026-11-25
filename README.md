# Proyecto Parcial 2 · CI/CD, pruebas automatizadas y observabilidad

Materia: Gestión del Proceso de Desarrollo de Software (UTEQ, IDGS16) · Docente: M.C. Emmanuel Martínez Hernández
Alumno: Luis Abraham Camacho Durán

Sistema web con **login, registro y CRUD de usuarios** (Express + PostgreSQL + front en HTML/JS), desplegado en
**AWS EC2** con **GitHub Actions**. El despliegue solo ocurre si pasan las pruebas de **Jest** (backend) y
**Playwright** (frontend). La app está instrumentada con **OpenTelemetry** y todo se observa en **OpenObserve**.

```
push a main ──► GitHub Actions
                 ├─ pruebas-backend   (Jest + Supertest + PostgreSQL)
                 ├─ pruebas-frontend  (Playwright)
                 ├─ registrar-pruebas ──HTTP/JSON──► OpenObserve (stream cicd_pipeline)
                 └─ desplegar (solo si todo pasó) ──SSH──► EC2: docker compose up -d --build
                                                             └─ evento de despliegue ──► OpenObserve

EC2 (Docker Compose)
  nginx :80 (proxy inverso) ─► app :3000 (Express) ─► db (PostgreSQL 16)
  app ──OTLP──► otel-collector ──OTLP/HTTP──► openobserve :5080
  otel-collector (hostmetrics) lee CPU, RAM, red, disco y carga del servidor
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de la app y de la base de datos |
| POST | `/api/auth/register` | Registro `{name, email, password}` → token JWT |
| POST | `/api/auth/login` | Login `{email, password}` → token JWT |
| GET | `/api/auth/me` | Usuario de la sesión |
| GET/POST | `/api/users` | Listar / crear usuarios (requiere token) |
| GET/PUT/DELETE | `/api/users/:id` | Ver / editar / eliminar (requiere token) |

## Correr localmente

```bash
npm ci
export DATABASE_URL=postgres://postgres@localhost:5432/parcial2
npm run test:back        # Jest
npm run test:e2e         # Playwright (levanta la app solo)
node src/server.js       # http://localhost:3000
```

## Observabilidad (OpenObserve)

- **Logs**: stream `default` (logs estructurados de la app: peticiones con statusCode, latencia y timestamp; excepciones).
- **Trazas**: cada petición HTTP con sus spans de Express y de las consultas a PostgreSQL.
- **Métricas**: `http_requests_total`, `http_errors_total`, `http_request_duration_ms` por endpoint; métricas del host
  `system_cpu_utilization`, `system_memory_utilization`, `system_network_io`, `system_filesystem_utilization`, `system_cpu_load_average_1m`.
- **Pipeline**: stream de logs `cicd_pipeline` con cada ejecución de pruebas y cada despliegue.
- **Temperatura**: la app intenta leer `/sys/class/thermal`; las instancias virtuales de EC2 no exponen ese sensor,
  así que se registra el aviso `sensor_temperatura_no_disponible`.

## Demostración de fallo y éxito

1. Fallo: cambiar el texto del botón de login en `public/index.html` (por ejemplo "Entrar" → "Ingresar") y hacer push.
   Playwright falla, el evento queda en OpenObserve y el job de despliegue no corre (no hay SSH a EC2).
2. Éxito: regresar el texto y hacer push. Pasan las pruebas, se actualizan los contenedores y se registra el despliegue.
