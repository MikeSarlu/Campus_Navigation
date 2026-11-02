// Extrae el contorno del campus (área "university" de OpenStreetMap que contiene el centro de la
// UDLAP) de las teselas locales y lo guarda en src/features/map/campusBoundary.json. La app lo usa
// para atenuar los alrededores y limitar el mapa al campus.
//
// Se toma de zoom 13 porque ahí el campus completo cabe en una sola tesela (en zoom 15 viene
// partido en varias). Se ejecuta solo al final de `npm run fetch-tiles`, o a mano:
//   node scripts/extract-boundary.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const Z = 13;
const CENTER = [-98.2833, 19.0546];

const tileX = (lng) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const tileY = (lat) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z);
};

function inside([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const [x, y] = [tileX(CENTER[0]), tileY(CENTER[1])];
const tile = new VectorTile(new PbfReader(readFileSync(`public/tiles/${Z}/${x}/${y}.mvt`)));
const landuse = tile.layers.landuse;
let ring = null;
for (let i = 0; landuse && i < landuse.length && !ring; i++) {
  const f = landuse.feature(i);
  if (f.properties.kind !== 'university') continue;
  const g = f.toGeoJSON(x, y, Z).geometry;
  for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
    if (inside(CENTER, poly[0])) ring = poly[0];
  }
}
if (!ring) throw new Error('No se encontró el área de la universidad que contiene el centro del campus');

// 6 decimales ≈ 0.1 m: suficiente y deja el archivo pequeño.
const round = (n) => Math.round(n * 1e6) / 1e6;
const coords = ring.map(([lng, lat]) => [round(lng), round(lat)]);
const lngs = coords.map((c) => c[0]);
const lats = coords.map((c) => c[1]);
const out = {
  type: 'Feature',
  properties: { source: 'OpenStreetMap vía Protomaps', bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] },
  geometry: { type: 'Polygon', coordinates: [coords] },
};
writeFileSync('src/features/map/campusBoundary.json', JSON.stringify(out) + '\n');
console.log(`Contorno del campus: ${coords.length} puntos`);
