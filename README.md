# Map Generator — Next.js

Migración de `demo-v3.html` a una aplicación Next.js con App Router y TypeScript.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

## Estructura

- `app/editor-markup.html`: estructura visual del editor.
- `app/globals.css`: estilos del editor.
- `public/editor-runtime.js`: comportamiento existente, separado del marcado.
- `app/editor-runtime.tsx`: carga Chart.js desde npm y arranca el runtime del editor.

El archivo HTML original permanece intacto como respaldo durante la migración gradual a componentes React.

## Persistencia

Los mapas se guardan mediante `/api/maps` en `data/maps`, con snapshots independientes por fecha. `localStorage` sólo recuerda el identificador del mapa activo.

## Autenticación y base de datos

La aplicación persiste usuarios, sesiones y mapas en una base de datos MariaDB/MySQL
(`mapgen`), independiente del catálogo de Cacti. Hay tres modos de autenticación
configurables por variables de entorno, combinables: local, forward-auth de Authelia y
OIDC de Authelia. Los roles son `admin`, `editor` y `viewer` (jerárquicos): viewer sólo
puede ver mapas y modo presentación; editor además crea/edita mapas; admin además
gestiona usuarios.

### Aprovisionamiento de la base de datos

```bash
mysql -u root -p < docs/db-provisioning.sql
```

Esto crea la base `mapgen` y un usuario dedicado (edita la contraseña en el script antes
de ejecutarlo). El esquema de tablas (`users`, `sessions`, `maps`) es idempotente y se
crea solo, en el primer uso del pool de conexión — no hace falta una herramienta de
migraciones aparte.

Los mapas existentes en `data/maps/*.json` se importan a la tabla con:

```bash
npm run maps:import
```

**Importante:** hay que arrancar la aplicación al menos una vez (`npm run dev` o
`npm run start`) antes de ejecutar `npm run maps:import`, porque es la app la que crea las
tablas (`users`, `sessions`, `maps`) en su primer uso del pool de conexión; el script de
importación no las crea.

El script omite los ids que ya existan en la tabla y **no borra los archivos**: quedan en
`data/maps/` como respaldo.

### Variables de entorno

| Variable | Default | Uso |
| --- | --- | --- |
| `MAPGEN_DB_HOST` | `127.0.0.1` | Host de MariaDB/MySQL para la base `mapgen` |
| `MAPGEN_DB_PORT` | `3306` | Puerto |
| `MAPGEN_DB_USER` | `mapgen` | Usuario dedicado (ver aprovisionamiento) |
| `MAPGEN_DB_PASSWORD` | `vacío` | Contraseña |
| `MAPGEN_DB_NAME` | `mapgen` | Nombre de la base |
| `MAPGEN_DB_SOCKET` | — | Socket local opcional, tiene prioridad sobre host/puerto |
| `AUTH_LOCAL_ENABLED` | `true` | Habilita el formulario de login local |
| `AUTH_FORWARD_ENABLED` | `false` | Habilita la identidad por headers de Authelia (forward-auth) |
| `AUTH_OIDC_ENABLED` | `false` | Habilita el botón "Entrar con Authelia" (OIDC) |
| `AUTH_OIDC_ISSUER` | — | URL del issuer OIDC de Authelia |
| `AUTH_OIDC_CLIENT_ID` | — | Client ID registrado en Authelia |
| `AUTH_OIDC_CLIENT_SECRET` | — | Client secret registrado en Authelia |
| `AUTH_SESSION_SECRET` | — | Firma HMAC de la cookie temporal del flujo OIDC (**obligatoria** si `AUTH_OIDC_ENABLED=true`) |
| `AUTH_ADMIN_GROUPS` | — | Grupos de Authelia (separados por coma) que otorgan rol `admin` |
| `AUTH_EDITOR_GROUPS` | — | Grupos de Authelia (separados por coma) que otorgan rol `editor` |
| `AUTH_DEFAULT_ROLE` | `viewer` | Rol asignado si ningún grupo coincide |
| `AUTH_SESSION_TTL_HOURS` | `168` | Vida de la sesión local (deslizante) |
| `AUTH_BOOTSTRAP_ADMIN_USER` | — | Usuario a crear/promover a admin al arrancar (ver caveat abajo) |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | — | Contraseña de ese admin |

**Nota sobre el bootstrap:** si ya existe un usuario local con el mismo nombre que
`AUTH_BOOTSTRAP_ADMIN_USER`, el arranque lo **promueve a admin** en vez de crear uno
nuevo. Elige un `AUTH_BOOTSTRAP_ADMIN_USER` con poca probabilidad de coincidir con un
usuario homónimo ya existente.

### Modo local

Login con usuario/contraseña propios de la app (`scrypt` + sal, sin dependencias
externas). El primer admin se crea (o se promueve, ver nota de arriba) automáticamente al
arrancar si `AUTH_BOOTSTRAP_ADMIN_USER`/`AUTH_BOOTSTRAP_ADMIN_PASSWORD` están definidas y
no existe ningún admin activo. Los usuarios locales se gestionan luego desde el panel de
administración dentro del editor (solo visible para admins).

### Modo forward-auth (Authelia clásico)

Con `AUTH_FORWARD_ENABLED=true`, la app confía en los headers `Remote-User`,
`Remote-Groups`, `Remote-Name` y `Remote-Email` que le llegan en cada petición: si
`Remote-User` está presente, aprovisiona/actualiza ese usuario (`provider='authelia'`) y
calcula su rol desde `Remote-Groups` (salvo que un admin ya le haya fijado el rol
manualmente). No hay validación de un secreto compartido ni lista de proxies confiables:
el modelo de confianza es **bind a localhost**.

**Nota de seguridad — colisión de nombres:** si un nombre de usuario de Authelia coincide
con el de una cuenta **local** existente que tiene contraseña, el login se **rechaza** (tanto
en forward-auth como en OIDC): una identidad de Authelia nunca puede tomar el control de
una cuenta local por homonimia. El intento queda registrado en el log del servidor.

**Requisitos de seguridad obligatorios de este modo** (no son opcionales):

- Next debe escuchar **solo** en `127.0.0.1`: `next start -H 127.0.0.1` (el script
  `npm run start` por defecto escucha en todas las interfaces; hay que pasar `-H
  127.0.0.1` explícitamente, o equivalente, en el comando/servicio real).
- Apache + Authelia debe ser el **único** ingreso a la aplicación — ningún otro camino de
  red debe llegar al puerto de Next.
- El proxy **debe** eliminar cualquier header `Remote-*` que venga del cliente antes de
  que Authelia agregue los suyos propios tras autenticar. Si esto no se hace, cualquier
  cliente puede suplantar identidad y rol enviando esos headers directamente.

Ejemplo de configuración Apache:

```apache
# Apache + Authelia forward-auth.
# REQUISITO DE SEGURIDAD (modelo de confianza elegido: bind a localhost):
#   - Next DEBE escuchar solo en 127.0.0.1:  next start -H 127.0.0.1
#   - Apache/Authelia es el único ingreso a la app.
#   - Eliminar SIEMPRE los headers Remote-* que vengan del cliente antes de
#     que Authelia agregue los suyos.
<Location />
  RequestHeader unset Remote-User
  RequestHeader unset Remote-Groups
  RequestHeader unset Remote-Name
  RequestHeader unset Remote-Email
  # También el host reenviado: evita que un cliente inyecte el origen usado al
  # construir el redirect_uri de OIDC (Apache lo antepone si el cliente lo envía).
  RequestHeader unset X-Forwarded-Host
  # ... configuración estándar de Authelia (auth_request / ErrorDocument 401) que
  #     reinyecta Remote-User/Remote-Groups/Remote-Name/Remote-Email tras autenticar ...
</Location>
```

### Modo OIDC (Authorization Code + PKCE)

Con `AUTH_OIDC_ENABLED=true`, la página `/login` muestra un botón "Entrar con Authelia"
que dispara el flujo Authorization Code + PKCE contra el issuer de Authelia (sin
dependencias externas: descubrimiento OIDC, PKCE y validación del ID token vía JWKS están
implementados a mano). El redirect URI a registrar en Authelia es:

```text
https://<host>/api/auth/oidc/callback
```

con scopes `openid profile email groups`. Ejemplo de configuración del cliente en
Authelia:

```yaml
# Authelia: cliente OIDC
identity_providers:
  oidc:
    clients:
      - client_id: mapgen
        client_secret: "$pbkdf2-sha512$..."
        redirect_uris:
          - https://mapas.ejemplo.com/api/auth/oidc/callback
        scopes: [openid, profile, email, groups]
        authorization_policy: one_factor
```

### Smoke test manual

Estos comandos los ejecuta quien despliegue/pruebe la app (no se ejecutan como parte del
build):

```bash
# 1. Aprovisionar la DB y arrancar con bootstrap:
#    AUTH_BOOTSTRAP_ADMIN_USER=admin AUTH_BOOTSTRAP_ADMIN_PASSWORD=... npm run dev
# 2. Login local:
curl -si -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"..."}'          # → 200 + Set-Cookie
# 3. Sin sesión:
curl -si localhost:3000/api/maps                       # → 401
# 4. Forward-auth (con AUTH_FORWARD_ENABLED=true):
curl -si localhost:3000/api/maps \
  -H 'Remote-User: ana' -H 'Remote-Groups: mapgen-editors'   # → 200
# 5. Importar mapas:
npm run maps:import
```

## Integración con Cacti

La aplicación consulta el catálogo en MySQL/MariaDB. Según el modo configurado, obtiene las
métricas almacenadas en la base de datos o lee los archivos RRD locales. En modo `db`, el
colector Python se ejecuta después del poller de Cacti, detecta las fuentes usadas por los
mapas, lee únicamente esos RRD y guarda una muestra. El navegador conserva referencias por
`localDataId`, nunca rutas arbitrarias.

`CACTI_METRICS_SOURCE` selecciona la fuente de valores: `rrd` (predeterminado) ejecuta
`rrdtool` durante la petición y no requiere la tabla `mapgen_rrd_samples`; `db` consulta esa
tabla y requiere el colector Python. Ambos modos consultan el catálogo de Cacti en la base de datos. En
modo `rrd`, el usuario que ejecuta Next.js necesita permiso de lectura sobre los RRD y permiso
para ejecutar el binario configurado en `CACTI_RRDTOOL`.

1. Copia `.env.example` a `.env.local`, ajusta la conexión y configura
   `CACTI_RRD_PATH` con uno o más directorios locales donde Cacti guarda los archivos RRD,
   separados por comas cuando exista más de uno.
2. Instala las dependencias Python con `pip install -r ../requirements.txt`.
3. Crea la tabla ejecutando `scripts/schema.mysql.sql`, o una sola vez con:

   ```bash
   python3 scripts/collect_cacti_metrics.py --init-schema
   ```

4. El usuario requiere `SELECT` sobre `host`, `host_snmp_cache`, `data_local`,
   `data_template_data`, `poller_item` y `SELECT, INSERT, UPDATE, DELETE` sobre
   `mapgen_rrd_samples` cuando se utilice el modo `db`.

   ```sql
   GRANT SELECT ON cacti.host TO 'cacti_map_reader'@'localhost';
   GRANT SELECT ON cacti.host_snmp_cache TO 'cacti_map_reader'@'localhost';
   GRANT SELECT ON cacti.data_local TO 'cacti_map_reader'@'localhost';
   GRANT SELECT ON cacti.data_template_data TO 'cacti_map_reader'@'localhost';
   GRANT SELECT ON cacti.poller_item TO 'cacti_map_reader'@'localhost';
   GRANT SELECT, INSERT, UPDATE, DELETE ON cacti.mapgen_rrd_samples TO 'cacti_map_reader'@'localhost';
   ```
5. Vincula fuentes desde **Fuente de datos · Cacti** en los enlaces o agrega series Cacti a las gráficas.
6. Ejecuta el colector después del poller. Por ejemplo, si Cacti corre cada cinco minutos:

   ```cron
   */5 * * * * /usr/bin/php /usr/share/cacti/site/poller.php >/dev/null 2>&1 && /usr/bin/python3 /opt/map-generator/scripts/collect_cacti_metrics.py >>/var/log/mapgen-collector.log 2>&1
   ```

   Si el poller ya tiene su propia entrada, agrega el colector al final del mismo script o
   wrapper para garantizar que sólo corra cuando el poller haya terminado.

El colector usa un lock no bloqueante (`MAPGEN_COLLECTOR_LOCK`) para evitar dos ejecuciones
simultáneas si un ciclo del poller tarda más de lo normal.

La vista Live toma la muestra almacenada más reciente de los últimos 30 minutos. La vista por
día calcula el promedio de las muestras guardadas para esa fecha. Las gráficas consultan la
misma tabla y agrupan las muestras según su escala temporal y consolidación. El colector detecta
tanto las fuentes de enlaces como cada serie usada por las gráficas. El colector elimina datos
anteriores a `MAPGEN_METRICS_RETENTION_DAYS` (400 días por defecto). Cacti suele almacenar
tráfico en bytes/s, por lo que el binding aplica por defecto el multiplicador 8; puede
cambiarse a bits/s para plantillas que ya entreguen esa unidad.

Endpoints disponibles:

- `GET /api/cacti/status`
- `GET /api/cacti/devices`
- `GET /api/cacti/devices/:id/graphs`
- `GET /api/cacti/devices/:id/data-sources`
- `POST /api/cacti/metrics`
