import { describe, expect, it } from 'vitest';
import type { CampusData, GraphNode, LngLat } from '../data/types';
import { buildSteps, currentStepIndex } from './instructions';
import { projectOnLine, sliceLineFrom } from './planar';
import { findRoute, START_ID } from './route';
import { routeTargets } from './targets';

const O: LngLat = [-98.28, 19.05];
/** Punto a `e` metros al este y `n` al norte del origen. */
const at = (e: number, n: number): LngLat => [O[0] + e / (111_320 * Math.cos((O[1] * Math.PI) / 180)), O[1] + n / 110_540];

// Red en forma de T:
//   c(0,100) ── d(60,100)
//     │
//   b(0,50) ── e(80,50)
//     │
//   a(0,0)
function campus(): CampusData {
  const pts: Record<string, LngLat> = { a: at(0, 0), b: at(0, 50), c: at(0, 100), d: at(60, 100), e: at(80, 50) };
  const nodes: GraphNode[] = Object.entries(pts).map(([id, pos]) => ({ id, pos, kind: 'path' }));
  const len = (x: string, y: string) => Math.hypot(...[0, 1].map((i) => (pts[x][i] - pts[y][i]) * (i ? 110_540 : 105_220)));
  const edges = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['b', 'e']].map(([from, to]) => ({ from, to, lengthM: len(from, to), kind: 'outdoor' as const }));
  nodes.find((n) => n.id === 'd')!.label = { es: 'junto a la cafetería', en: 'by the cafeteria' };
  return {
    version: 't', generatedAt: '',
    places: [{ id: 'cafe', name: { es: 'Cafetería', en: 'Cafe' }, kind: 'service', categories: [], location: at(62, 105), entranceNodeIds: [] }],
    buildings: [],
    graph: { nodes, edges },
  };
}

describe('findRoute', () => {
  it('va por el camino más corto y une el inicio al tramo más cercano', () => {
    const route = findRoute(campus(), at(5, 20), ['d'])!;
    expect(route.nodes.map((n) => n.id)).toEqual([START_ID, 'b', 'c', 'd']);
    // 5 m hasta el camino + 30 m hasta b + 50 + 60
    expect(route.lengthM).toBeCloseTo(145, 0);
    expect(route.etaS).toBeCloseTo(145 / 1.3, 0);
  });

  it('elige el destino más cercano cuando hay varios', () => {
    expect(findRoute(campus(), at(0, 0), ['d', 'e'])!.nodes.at(-1)!.id).toBe('e');
  });

  it('devuelve null si el destino no está conectado', () => {
    const d = campus();
    d.graph.nodes.push({ id: 'island', pos: at(500, 500), kind: 'path' });
    expect(findRoute(d, at(0, 0), ['island'])).toBeNull();
  });

  it('sin entradas, el destino de un lugar es el nodo más cercano a su marcador', () => {
    const d = campus();
    expect(routeTargets({ type: 'place', place: d.places[0] }, d)).toEqual(['d']);
  });
});

describe('buildSteps', () => {
  it('genera inicio, giros con referencia y llegada', () => {
    const steps = buildSteps(findRoute(campus(), at(0, 0), ['d'])!);
    expect(steps.map((s) => (s.kind === 'turn' ? s.turn : s.kind))).toEqual(['start', 'right', 'arrive']);
    expect(steps[0]).toMatchObject({ heading: 'n' });
    expect(steps[1].alongM).toBeCloseTo(100, 0);
    expect(steps[0].distanceM).toBeCloseTo(100, 0);
    expect(steps[2]).toMatchObject({ landmark: { es: 'junto a la cafetería' } });
  });

  it('seguir derecho por un cruce no genera instrucción', () => {
    const steps = buildSteps(findRoute(campus(), at(0, 0), ['c'])!);
    expect(steps.map((s) => s.kind)).toEqual(['start', 'arrive']);
  });

  it('currentStepIndex avanza al acercarse al giro', () => {
    const steps = buildSteps(findRoute(campus(), at(0, 0), ['d'])!);
    expect(currentStepIndex(steps, 50)).toBe(0);
    expect(currentStepIndex(steps, 97)).toBe(1);
  });
});

describe('progreso sobre la ruta', () => {
  const line = [at(0, 0), at(0, 100), at(60, 100)];

  it('proyecta la posición y mide la separación', () => {
    const p = projectOnLine(at(4, 30), line);
    expect(p.alongM).toBeCloseTo(30, 0);
    expect(p.offM).toBeCloseTo(4, 0);
  });

  it('recorta lo ya caminado', () => {
    const rest = sliceLineFrom(line, 130);
    expect(rest).toHaveLength(2);
    expect(projectOnLine(rest[0], line).alongM).toBeCloseTo(130, 0);
  });
});
