// Extrae del build mundial de Protomaps (datos de OpenStreetMap) las teselas vectoriales
// que cubren el campus y las guarda como archivos estáticos en public/tiles/{z}/{x}/{y}.mvt,
// junto con las fuentes que usa el estilo. Así el mapa funciona sin servidor de teselas
// y se puede guardar sin conexión.
//
// Uso: node scripts/fetch-tiles.mjs [YYYYMMDD]
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { PMTiles } from 'pmtiles';

// Campus UDLAP con margen (oeste, sur, este, norte).
export const BBOX = [-98.2965, 19.0440, -98.2700, 19.0635];
const MAX_ZOOM = 15; // máximo del build; MapLibre amplía más allá de este nivel
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium'];
const RANGES = ['0-255', '256-511', '8192-8447'];

const lngToX = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

async function latestBuild() {
  const builds = await (await fetch('https://build-metadata.protomaps.dev/builds.json')).json();
  return builds.at(-1).key.replace('.pmtiles', '');
}

const build = process.argv[2] ?? (await latestBuild());
const archive = new PMTiles(`https://build.protomaps.com/${build}.pmtiles`);
await rm('public/tiles', { recursive: true, force: true });

let count = 0;
let bytes = 0;
for (let z = 0; z <= MAX_ZOOM; z++) {
  const [x0, x1] = [lngToX(BBOX[0], z), lngToX(BBOX[2], z)];
  const [y0, y1] = [latToY(BBOX[3], z), latToY(BBOX[1], z)];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const tile = await archive.getZxy(z, x, y);
      if (!tile) continue;
      let data = new Uint8Array(tile.data);
      if (data[0] === 0x1f && data[1] === 0x8b) data = gunzipSync(data);
      await mkdir(`public/tiles/${z}/${x}`, { recursive: true });
      await writeFile(`public/tiles/${z}/${x}/${y}.mvt`, data);
      count++;
      bytes += data.length;
    }
  }
}

await rm('public/fonts', { recursive: true, force: true });
for (const font of FONTS) {
  await mkdir(`public/fonts/${font}`, { recursive: true });
  for (const range of RANGES) {
    const url = `https://protomaps.github.io/basemaps-assets/fonts/${encodeURIComponent(font)}/${range}.pbf`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    await writeFile(`public/fonts/${font}/${range}.pbf`, new Uint8Array(await res.arrayBuffer()));
  }
}

const meta = { build, bbox: BBOX, maxZoom: MAX_ZOOM, generatedAt: new Date().toISOString() };
await writeFile('public/tiles/meta.json', JSON.stringify(meta, null, 2) + '\n');
console.log(`Build ${build}: ${count} teselas, ${(bytes / 1024).toFixed(0)} KB`);
