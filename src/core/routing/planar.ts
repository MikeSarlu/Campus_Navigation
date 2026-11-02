import type { LngLat } from '../data/types';

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Coordenadas en metros (este, norte) de `p` respecto a `origin`. Válido a escala de campus. */
export function toMeters(p: LngLat, origin: LngLat): [number, number] {
  return [(p[0] - origin[0]) * mPerDegLng(origin[1]), (p[1] - origin[1]) * M_PER_DEG_LAT];
}

/** Rumbo de a hacia b, en grados desde el norte (0–360). */
export function bearing(a: LngLat, b: LngLat): number {
  const [x, y] = toMeters(b, a);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/** Diferencia de rumbos en (−180, 180]: positiva = giro a la derecha. */
export function turnAngle(from: number, to: number): number {
  const d = ((to - from + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Posición sobre una polilínea: distancia recorrida hasta el punto más cercano y separación de la línea. */
export function projectOnLine(pos: LngLat, line: LngLat[]): { alongM: number; offM: number } {
  let walked = 0;
  let best = { alongM: 0, offM: Infinity };
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = toMeters(line[i - 1], pos);
    const [bx, by] = toMeters(line[i], pos);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (len * len))) : 0;
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.offM) best = { alongM: walked + t * len, offM: off };
    walked += len;
  }
  return best;
}

/** Parte de la polilínea desde `alongM` metros hasta el final (lo que falta por caminar). */
export function sliceLineFrom(line: LngLat[], alongM: number): LngLat[] {
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [dx, dy] = toMeters(line[i], line[i - 1]);
    const len = Math.hypot(dx, dy);
    if (walked + len >= alongM) {
      const t = len ? (alongM - walked) / len : 0;
      const a = line[i - 1];
      const b = line[i];
      return [[a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], ...line.slice(i)];
    }
    walked += len;
  }
  return line.slice(-1);
}

/** Punto a `alongM` metros sobre la polilínea. */
export function pointAlong(line: LngLat[], alongM: number): LngLat {
  return sliceLineFrom(line, Math.max(0, alongM))[0];
}
