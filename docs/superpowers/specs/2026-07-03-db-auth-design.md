# Diseño: persistencia en MariaDB + autenticación (local, forward-auth y OIDC de Authelia)

**Fecha:** 2026-07-03
**Estado:** aprobado

## Contexto y objetivo

Hoy los mapas se guardan como archivos JSON en `data/maps/` y la aplicación no tiene
autenticación. Este diseño mueve los datos persistentes a una base de datos MariaDB y agrega
un sistema de login con tres modos configurables: usuarios locales, forward-auth de Authelia
(headers confiables del proxy) y OIDC de Authelia, con roles admin/editor/viewer.

Decisiones tomadas con el usuario:

- Motor: el servidor MariaDB/MySQL existente (el mismo que usa Cacti), base nueva `mapgen`.
- Integración Authelia: ambos modos (forward-auth y OIDC), activables por entorno.
- Roles: `admin`, `editor`, `viewer`.
- Gestión de usuarios locales: UI de administración dentro de la app.
- Rol de usuarios Authelia: derivado de grupos en cada login, con posibilidad de que un
  admin lo fije manualmente (el fijado manual no se sobreescribe).
- Enfoque: implementación propia minimalista, sin dependencias nuevas (scrypt de
  `node:crypto`, sesiones en DB, OIDC Authorization Code + PKCE a mano).

## 1. Base de datos

- Base `mapgen` en el MariaDB existente, usuario dedicado con lectura/escritura.
- Configuración por variables de entorno, mismo patrón que `lib/cacti/config.ts`:
  `MAPGEN_DB_HOST`, `MAPGEN_DB_PORT`, `MAPGEN_DB_USER`, `MAPGEN_DB_PASSWORD`,
  `MAPGEN_DB_NAME` (default `mapgen`), `MAPGEN_DB_SOCKET` opcional.
- Pool propio en `lib/db.ts` (mysql2/promise), independiente del pool de Cacti.
- Esquema idempotente: `CREATE TABLE IF NOT EXISTS` ejecutado una vez por proceso al
  primer uso del pool. Sin herramienta de migraciones.

### Esquema

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(190) NOT NULL UNIQUE,
  display_name  VARCHAR(190) NULL,
  email         VARCHAR(190) NULL,
  password_hash VARCHAR(255) NULL,          -- NULL para usuarios solo-Authelia
  provider      ENUM('local','authelia') NOT NULL DEFAULT 'local',
  role          ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
  role_locked   TINYINT(1) NOT NULL DEFAULT 0, -- rol fijado por un admin; los grupos no lo pisan
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   CHAR(64) PRIMARY KEY,        -- SHA-256 hex del token de la cookie
  user_id      INT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS maps (
  id         VARCHAR(80) PRIMARY KEY,       -- mismo formato de id actual
  name       VARCHAR(255) NOT NULL,
  days       JSON NOT NULL,                 -- payload actual de MapRecord.days
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### Migración de mapas

- `lib/maps/store.ts` se reescribe contra la tabla `maps`. Las rutas API
  (`/api/maps`, `/api/maps/[id]`) conservan el mismo contrato; el editor no cambia.
- El lock por id en memoria (`withMapLock`) se conserva para serializar las escrituras
  read-modify-write de un mismo mapa dentro del proceso.
- Script `npm run maps:import` (`scripts/import-maps.mjs`): importa `data/maps/*.json` a la
  tabla, omite ids ya existentes, no borra los archivos (quedan como respaldo).

## 2. Autenticación — tres modos configurables

Variables de entorno:

| Variable | Default | Uso |
| --- | --- | --- |
| `AUTH_LOCAL_ENABLED` | `true` | Formulario de login local |
| `AUTH_FORWARD_ENABLED` | `false` | Headers de Authelia vía proxy |
| `AUTH_FORWARD_TRUSTED_PROXIES` | — | IPs/CIDRs desde los que se confía en los headers |
| `AUTH_OIDC_ENABLED` | `false` | Botón "Entrar con Authelia" |
| `AUTH_OIDC_ISSUER` | — | URL del issuer de Authelia |
| `AUTH_OIDC_CLIENT_ID` / `AUTH_OIDC_CLIENT_SECRET` | — | Cliente registrado en Authelia |
| `AUTH_ADMIN_GROUPS` / `AUTH_EDITOR_GROUPS` | — | Grupos (separados por coma) → rol |
| `AUTH_DEFAULT_ROLE` | `viewer` | Rol si ningún grupo coincide |
| `AUTH_SESSION_TTL_HOURS` | `168` | Vida de la sesión (deslizante) |
| `AUTH_SESSION_SECRET` | — | HMAC de la cookie temporal del flujo OIDC (obligatoria si OIDC está habilitado) |
| `AUTH_BOOTSTRAP_ADMIN_USER` / `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | — | Primer admin local |

### Local

- Contraseñas con `scrypt` de `node:crypto` (N=16384, r=8, p=1, salt de 16 bytes),
  formato almacenado `scrypt$N$r$p$salt$hash`, comparación con `timingSafeEqual`.
- `POST /api/auth/login` valida credenciales, crea sesión, devuelve el usuario.
- Bootstrap: al arrancar, si no existe ningún admin activo y las variables
  `AUTH_BOOTSTRAP_ADMIN_*` están definidas, se crea ese admin local.

### Forward-auth (Authelia clásico)

- Si la petición trae `Remote-User` y la IP de origen del socket está en
  `AUTH_FORWARD_TRUSTED_PROXIES`, se acepta la identidad: se aprovisiona o actualiza el
  usuario (`provider='authelia'`, `display_name` de `Remote-Name`, `email` de
  `Remote-Email`), se calcula el rol desde `Remote-Groups` y se crea una sesión propia de
  la app de forma transparente (sin pasar por `/login`).
- Si los headers no están o la IP no es confiable, se ignoran y aplica el flujo normal.

### OIDC (Authorization Code + PKCE, sin dependencias)

- `GET /api/auth/oidc/start`: descubre `/.well-known/openid-configuration` del issuer
  (con caché en memoria), genera `state` + `code_verifier`, los guarda en una cookie
  temporal firmada (HMAC-SHA256 con `AUTH_SESSION_SECRET`), redirige a
  Authelia con `scope=openid profile email groups`.
- `GET /api/auth/oidc/callback`: valida `state`, intercambia el código en el token
  endpoint (client secret + PKCE), obtiene los claims del ID token (validación de firma
  vía JWKS del issuer, `iss`, `aud`, `exp`), aprovisiona/actualiza el usuario con
  `preferred_username`, `name`, `email`, `groups`, crea sesión y redirige a `/`.

### Roles y sincronización

- En cada login vía Authelia (forward u OIDC): si el usuario tiene `role_locked=0`, el rol
  se recalcula desde los grupos (`AUTH_ADMIN_GROUPS` > `AUTH_EDITOR_GROUPS` >
  `AUTH_DEFAULT_ROLE`). Con `role_locked=1` se respeta el rol asignado por el admin.
- Al cambiar un rol desde la UI de admin se marca `role_locked=1`.
- Usuarios locales: rol asignado por el admin (o bootstrap), sin sincronización.
- Usuarios con `active=0` no pueden iniciar sesión (en ningún modo) y sus sesiones se
  invalidan.

## 3. Sesiones y protección de rutas

- Cookie `mapgen_session`: token aleatorio de 32 bytes (base64url), `httpOnly`,
  `SameSite=Lax`, `Secure` cuando `x-forwarded-proto` es https, `Path=/`.
- En DB solo se guarda el SHA-256 del token. TTL deslizante: `expires_at` se extiende
  cuando queda menos de la mitad. Las sesiones vencidas se purgan de forma oportunista.
- `middleware.ts` (edge, sin MySQL) solo hace la verificación barata: documento sin cookie
  de sesión → redirect a `/login` (excepto `/login` y rutas de auth). La validación real
  vive en `lib/auth/session.ts`.
- Helper central `requireUser(request, minRole?)`: valida la sesión contra la DB (y en su
  ausencia intenta forward-auth si está habilitado); devuelve el usuario o una respuesta
  401/403. Todas las rutas API lo usan.

Permisos por rol (jerárquicos: admin ⊃ editor ⊃ viewer):

| Acción | viewer | editor | admin |
| --- | --- | --- | --- |
| Ver mapas / modo presentación / series y catálogo de Cacti | ✔ | ✔ | ✔ |
| Crear, editar, borrar mapas | | ✔ | ✔ |
| Gestionar usuarios (`/api/admin/users`) | | | ✔ |

## 4. Endpoints nuevos

- `POST /api/auth/login` — login local `{username, password}`.
- `POST /api/auth/logout` — destruye la sesión y borra la cookie.
- `GET  /api/auth/me` — usuario actual `{id, username, displayName, role, provider}` y
  qué modos de login están habilitados (para que la UI se adapte).
- `GET  /api/auth/oidc/start` / `GET /api/auth/oidc/callback` — flujo OIDC.
- `GET/POST /api/admin/users`, `PATCH/DELETE /api/admin/users/[id]` — CRUD de usuarios
  (crear local, cambiar rol —marca `role_locked`—, resetear contraseña, activar/desactivar,
  eliminar). Un admin no puede desactivarse ni degradarse a sí mismo si es el último admin
  activo.

## 5. UI

- **Página `/login`**: página Next con el estilo de la app (temas claro/oscuro, CSP con
  nonce). Muestra formulario local y/o botón "Entrar con Authelia" según los modos
  habilitados (leídos de `/api/auth/me`). Errores en español.
- **Barra superior del editor**: nombre del usuario actual y botón de salir.
- **Panel de administración de usuarios**: modal dentro del editor, visible solo para
  admins (mismo patrón que los modales existentes en `public/editor/`): tabla de usuarios,
  alta de usuario local, cambio de rol, reset de contraseña, activar/desactivar.
- **Rol viewer**: el editor carga en modo solo lectura — se ocultan las herramientas de
  edición y los guardados se bloquean también en el servidor (la API es la autoridad).
- **Pantallas de error**: páginas con el estilo de la app (temas claro/oscuro, mensajes en
  español, botón para volver al inicio o a `/login`), compartiendo un mismo componente de
  layout de error:
  - `app/not-found.tsx` — 404 para rutas inexistentes (documentos).
  - `app/error.tsx` y `app/global-error.tsx` — errores de runtime/render (500); el detalle
    técnico va solo al log del servidor, nunca a la pantalla.
  - `/denied` — 403 cuando un usuario autenticado intenta entrar a algo que su rol no
    permite en navegación de documentos (p. ej. un viewer al panel de admin).
  - Los errores 400/401/403/5xx de la API siguen siendo JSON en español (`{error}`), como
    hasta ahora; el editor los muestra en sus toasts. La página `/login` presenta los
    errores de autenticación (credenciales inválidas, cuenta desactivada, fallo OIDC,
    sesión expirada) de forma amigable vía `?error=<código>`.

## 6. Manejo de errores

- DB de `mapgen` caída → las rutas API devuelven 503 con mensaje en español; el login
  local y OIDC muestran el error en la página.
- Issuer OIDC inaccesible o callback inválido → redirect a `/login?error=oidc` con
  mensaje genérico (el detalle va al log del servidor).
- Headers forward-auth desde IP no confiable → se ignoran silenciosamente (log en debug).
- Escrituras de mapas conservan la serialización por id (`withMapLock`).

## 7. Verificación

- `npm run typecheck` en cada tarea (sin `next build` ni navegador salvo petición
  explícita del usuario).
- Prueba manual de los tres modos: login local (bootstrap admin), forward-auth simulando
  headers con `curl` desde IP confiable y no confiable, OIDC contra una instancia de
  Authelia.
- Prueba del script de importación con los JSON existentes en `data/maps/`.

## Fuera de alcance

- Permisos por mapa (ownership/ACLs) — todos los autenticados ven todos los mapas.
- Almacenar en DB los samples de RRD (la tabla `mapgen_rrd_samples` de Cacti ya existe y
  no se toca).
- Alta disponibilidad multi-instancia (el lock de mapas sigue siendo por proceso).
- Registro de auditoría.
