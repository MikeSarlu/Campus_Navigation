import type { Anchor, LngLat, LocalXY } from './data/types';

// Aproximación plana: suficiente a escala de campus (error < 0.1 %).
const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LngLat, b: LngLat): number {
  const R = 6_371_008;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceXY(a: LocalXY, b: LocalXY): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Plano local (x a la derecha, y hacia abajo, en metros) → coordenadas geográficas. */
export function localToLngLat(xy: LocalXY, anchor: Anchor): LngLat {
  const u = xy[0] - anchor.refLocal[0];
  const v = anchor.refLocal[1] - xy[1];
  const t = rad(anchor.rotationDeg);
  const east = u * Math.cos(t) + v * Math.sin(t);
  const north = -u * Math.sin(t) + v * Math.cos(t);
  const [lng, lat] = anchor.refWorld;
  return [lng + east / mPerDegLng(lat), lat + north / M_PER_DEG_LAT];
}

export function lngLatToLocal(p: LngLat, anchor: Anchor): LocalXY {
  const [lng, lat] = anchor.refWorld;
  const east = (p[0] - lng) * mPerDegLng(lat);
  const north = (p[1] - lat) * M_PER_DEG_LAT;
  const t = rad(anchor.rotationDeg);
  const u = east * Math.cos(t) - north * Math.sin(t);
  const v = east * Math.sin(t) + north * Math.cos(t);
  return [anchor.refLocal[0] + u, anchor.refLocal[1] - v];
}

/** Distancia de un punto a un segmento, y el parámetro t ∈ [0,1] del punto más cercano. */
export function pointToSegment(p: LocalXY, a: LocalXY, b: LocalXY): { dist: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return { dist: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)), t };
}

export function pointInPolygon(p: LocalXY, poly: LocalXY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
