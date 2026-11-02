import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre corre su worker desde una URL blob:, que el service worker no controla: todo lo que
// ese worker descargue por su cuenta falla sin conexión. Por eso:
//  1. El código del worker se descarga aquí, en la página (sale de la caché sin conexión), y se le
//     entrega a MapLibre ya como blob:, sin descargas dentro del worker.
//  2. Teselas y fuentes se piden con el protocolo "campus://", que también descarga en la página.
const WORKER_URL = `${window.location.origin}/vendor/maplibre-gl-worker.mjs`; // copiado por scripts/copy-maplibre-worker.mjs

/** Se resuelve cuando el worker está listo; los mapas se crean después de esto. */
export const maplibreReady: Promise<void> = (async () => {
  try {
    const code = await (await fetch(WORKER_URL)).text();
    maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
  } catch {
    maplibregl.setWorkerUrl(WORKER_URL);
  }
})();

maplibregl.addProtocol('campus', async (params, abort) => {
  const res = await fetch(params.url.replace('campus://', `${window.location.origin}/`), { signal: abort.signal });
  if (!res.ok) throw new Error(`${res.status} ${params.url}`);
  return { data: await res.arrayBuffer() };
});

export { maplibregl };
