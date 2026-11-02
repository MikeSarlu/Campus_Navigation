import { describe, expect, it } from 'vitest';
import type { Anchor, LocalXY } from './data/types';
import { haversineM, localToLngLat, lngLatToLocal, pointInPolygon, pointToSegment } from './geo';

const anchor = (rotationDeg: number): Anchor => ({ refLocal: [10, 20], refWorld: [-98.2833, 19.0545], rotationDeg });

describe('localToLngLat', () => {
  it('el punto de referencia cae en refWorld', () => {
    expect(localToLngLat([10, 20], anchor(37))).toEqual([-98.2833, 19.0545]);
  });

  it('sin rotación, −y del plano apunta al norte', () => {
    const a = anchor(0);
    const p = localToLngLat([10, 0], a); // 20 m "arriba" del ancla
    expect(p[0]).toBeCloseTo(a.refWorld[0], 9);
    expect(haversineM(a.refWorld, p)).toBeCloseTo(20, 0);
    expect(p[1]).toBeGreaterThan(a.refWorld[1]);
  });

  it('con 90°, −y del plano apunta al este', () => {
    const a = anchor(90);
    const p = localToLngLat([10, 0], a);
    expect(p[1]).toBeCloseTo(a.refWorld[1], 9);
    expect(p[0]).toBeGreaterThan(a.refWorld[0]);
  });

  it.each([0, 37, 180, 271.5])('lngLatToLocal es la inversa (%s°)', (deg) => {
    const a = anchor(deg);
    const xy: LocalXY = [43.2, -7.5];
    const back = lngLatToLocal(localToLngLat(xy, a), a);
    expect(back[0]).toBeCloseTo(xy[0], 6);
    expect(back[1]).toBeCloseTo(xy[1], 6);
  });
});

describe('utilidades de geometría', () => {
  it('pointToSegment', () => {
    expect(pointToSegment([5, 3], [0, 0], [10, 0])).toEqual({ dist: 3, t: 0.5 });
    expect(pointToSegment([-4, 3], [0, 0], [10, 0])).toEqual({ dist: 5, t: 0 });
  });

  it('pointInPolygon', () => {
    const square: LocalXY[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });
});
