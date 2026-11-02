import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Copiado a public/ por scripts/copy-maplibre-worker.mjs antes de `dev` y `build`.
maplibregl.setWorkerUrl(`${window.location.origin}/vendor/maplibre-gl-worker.mjs`);

export { maplibregl };
