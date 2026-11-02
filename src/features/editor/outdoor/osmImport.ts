// Importa al grafo los caminos que OpenStreetMap ya tiene dentro del campus, leyendo las
// teselas locales (public/tiles). Es un punto de partida: luego se corrigen en el editor.
import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { CampusData, LngLat } from '../../../core/data/types';
import { pointInPolygon } from '../../../core/geo';
import { CAMPUS_BBOX } from '../../map/campusStyle';
import { addNode, connect } from '../ops';

const Z = 15;
const NOT_WALKABLE = new Set(['rail', 'ferry', 'aerialway']);

const lngToTileX = (lng: number) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const latToTileY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z);
};

/** Coordenada global en "píxeles de tesela" → lng/lat. */
function toLngLat(gx: number, gy: number, extent: number): LngLat {
  const n = 2 ** Z * extent;
  const lng = (gx / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * gy) / n))) * 180) / Math.PI;
  return [lng, lat];
}

/** Recorta el tramo p→q al cuadro [0, ext]² (Liang–Barsky). Null si queda fuera o degenerado. */
export function clipToTile(p: [number, number], q: [number, number], ext: number): [[number, number], [number, number]] | null {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  let t0 = 0;
  let t1 = 1;
  for (const [pk, qk] of [[-dx, p[0]], [dx, ext - p[0]], [-dy, p[1]], [dy, ext - p[1]]]) {
    if (pk === 0) {
      if (qk < 0) return null;
      continue;
    }
    const r = qk / pk;
    if (pk < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  if (t1 - t0 < 1e-9) return null;
  return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
}

type XY = [number, number];

/**
 * Une tramos que se cruzan o se tocan sin compartir un vértice (pasa porque las teselas
 * simplifican la geometría): los parte en el cruce y une puntas que quedan a menos de `tol`
 * de otro tramo. Trabaja en píxeles de tesela.
 */
export function joinTouching(segs: [XY, XY][], tol: number): [XY, XY][] {
  const cuts: number[][] = segs.map(() => []);
  const extra: [XY, XY][] = [];
  const bbox = segs.map(([a, b]) => [Math.min(a[0], b[0]) - tol, Math.min(a[1], b[1]) - tol, Math.max(a[0], b[0]) + tol, Math.max(a[1], b[1]) + tol]);
  const project = (p: XY, a: XY, b: XY) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return { t, d: Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]) };
  };
  const near = (p: XY, q: XY) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;

  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const [bi, bj] = [bbox[i], bbox[j]];
      if (bi[0] > bj[2] || bj[0] > bi[2] || bi[1] > bj[3] || bj[1] > bi[3]) continue;
      const [a, b] = segs[i];
      const [c, d] = segs[j];
      if (near(a, c) || near(a, d) || near(b, c) || near(b, d)) continue; // ya comparten (o casi) un vértice
      // Cruce propio en "X".
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (den !== 0) {
        const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
        const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
        if (t > 0 && t < 1 && u > 0 && u < 1) {
          cuts[i].push(t);
          cuts[j].push(u);
          continue;
        }
      }
      // Punta que casi toca el otro tramo (cruce en "T" sin vértice común).
      for (const [p, k, [s0, s1]] of [[a, j, segs[j]], [b, j, segs[j]], [c, i, segs[i]], [d, i, segs[i]]] as [XY, number, [XY, XY]][]) {
        const { t, d: dist } = project(p, s0, s1);
        if (dist <= tol && t > 0 && t < 1) {
          cuts[k].push(t);
          extra.push([p, [s0[0] + t * (s1[0] - s0[0]), s0[1] + t * (s1[1] - s0[1])]]);
        }
      }
    }
  }

  const out: [XY, XY][] = [];
  segs.forEach(([a, b], i) => {
    const ts = [0, ...cuts[i].sort((x, y) => x - y), 1];
    const at = (t: number): XY => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    for (let k = 1; k < ts.length; k++) if (ts[k] - ts[k - 1] > 1e-9) out.push([at(ts[k - 1]), at(ts[k])]);
  });
  return [...out, ...extra.filter(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6)];
}

interface Segment {
  a: [number, number]; // coordenadas globales en píxeles de tesela: redondeadas sirven de llave para unir vértices
  b: [number, number];
  extent: number;
}

async function readTiles(): Promise<{ segments: Segment[]; campus: LngLat[][] }> {
  const [w, s, e, n] = CAMPUS_BBOX;
  const segments: Segment[] = [];
  const campus: LngLat[][] = [];
  for (let x = lngToTileX(w); x <= lngToTileX(e); x++) {
    for (let y = latToTileY(n); y <= latToTileY(s); y++) {
      const res = await fetch(`/tiles/${Z}/${x}/${y}.mvt`);
      if (!res.ok) continue;
      const tile = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer())));

      const landuse = tile.layers.landuse;
      for (let i = 0; landuse && i < landuse.length; i++) {
        const f = landuse.feature(i);
        if (f.properties.kind !== 'university') continue;
        const geom = f.toGeoJSON(x, y, Z).geometry;
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
        for (const p of polys) campus.push(p[0] as LngLat[]);
      }

      const roads = tile.layers.roads;
      for (let i = 0; roads && i < roads.length; i++) {
        const f: VectorTileFeature = roads.feature(i);
        if (NOT_WALKABLE.has(String(f.properties.kind))) continue;
        const ext = roads.extent;
        for (const line of f.loadGeometry()) {
          for (let k = 1; k < line.length; k++) {
            // Las teselas se traslapan en los bordes: cada tramo se recorta exactamente al
            // cuadro de su tesela, así el tramo vecino comparte el mismo punto en el borde.
            const clipped = clipToTile([line[k - 1].x, line[k - 1].y], [line[k].x, line[k].y], ext);
            if (!clipped) continue;
            const [p, q] = clipped;
            segments.push({ a: [x * ext + p[0], y * ext + p[1]], b: [x * ext + q[0], y * ext + q[1]], extent: ext });
          }
        }
      }
    }
  }
  return { segments, campus };
}

/** Agrega los caminos del campus al grafo. Devuelve cuántos puntos y tramos se crearon. */
export async function importOsmPaths(commit: (fn: (d: CampusData) => void) => void): Promise<{ nodes: number; edges: number }> {
  const { segments, campus } = await readTiles();
  const inside = (p: LngLat) => campus.some((poly) => pointInPolygon(p, poly));
  let result = { nodes: 0, edges: 0 };

  commit((d) => {
    const ids = new Map<string, string>();
    const nodeFor = (g: [number, number], ext: number) => {
      // Los puntos de borde se calculan desde cada tesela por separado: se redondean (~0.3 m) para que coincidan.
      const key = `${Math.round(g[0])},${Math.round(g[1])}`;
      let id = ids.get(key);
      if (!id) {
        id = addNode(d, { kind: 'path', pos: toLngLat(g[0], g[1], ext) });
        ids.set(key, id);
      }
      return id;
    };
    const before = d.graph.edges.length;
    const extent = segments[0]?.extent ?? 4096;
    const campusSegs = segments
      .filter(({ a, b }) => inside(toLngLat((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, extent)))
      .map(({ a, b }): [XY, XY] => [a, b]);
    // ~1 m en píxeles de tesela a z15 en la latitud del campus.
    const pxPerM = extent / ((40_075_016 * Math.cos((CAMPUS_BBOX[1] * Math.PI) / 180)) / 2 ** Z);
    for (const [a, b] of joinTouching(campusSegs, pxPerM)) connect(d, nodeFor(a, extent), nodeFor(b, extent));
    result = { nodes: ids.size, edges: d.graph.edges.length - before };
  });
  return result;
}
