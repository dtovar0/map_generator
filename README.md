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
