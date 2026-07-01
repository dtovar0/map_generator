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
5. Selecciona un enlace en el editor y usa **Fuente de datos · Cacti**.
6. Ejecuta el colector después del poller. Por ejemplo, si Cacti corre cada cinco minutos:

   ```cron
   */5 * * * * /usr/bin/php /usr/share/cacti/site/poller.php >/dev/null 2>&1 && /usr/bin/python3 /opt/map-generator/scripts/collect_cacti_metrics.py >>/var/log/mapgen-collector.log 2>&1
   ```

   Si el poller ya tiene su propia entrada, agrega el colector al final del mismo script o
   wrapper para garantizar que sólo corra cuando el poller haya terminado.

El colector usa un lock no bloqueante (`MAPGEN_COLLECTOR_LOCK`) para evitar dos ejecuciones
simultáneas si un ciclo del poller tarda más de lo normal.

La vista Live toma la muestra almacenada más reciente de los últimos 30 minutos. La vista por
día calcula el promedio de las muestras guardadas para esa fecha. El colector elimina datos
anteriores a `MAPGEN_METRICS_RETENTION_DAYS` (400 días por defecto). Cacti suele almacenar
tráfico en bytes/s, por lo que el binding aplica por defecto el multiplicador 8; puede
cambiarse a bits/s para plantillas que ya entreguen esa unidad.

Endpoints disponibles:

- `GET /api/cacti/status`
- `GET /api/cacti/devices`
- `GET /api/cacti/devices/:id/graphs`
- `GET /api/cacti/devices/:id/data-sources`
- `POST /api/cacti/metrics`
