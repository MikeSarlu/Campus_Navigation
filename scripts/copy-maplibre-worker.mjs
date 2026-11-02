// Copia el worker de MapLibre a public/ tal cual. Importarlo con "?url" no sirve en
// desarrollo: Vite le inyecta su cliente, que no funciona dentro de un worker.
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('public/vendor', { recursive: true });
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/vendor/maplibre-gl-worker.mjs');
