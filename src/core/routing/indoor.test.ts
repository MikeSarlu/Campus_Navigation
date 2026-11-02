import { describe, expect, it } from 'vitest';
import { addNode, connect } from '../../features/editor/ops';
import type { CampusData, LocalXY } from '../data/types';
import { buildIndoorLeg, doorSide } from './indoor';
import { findRoute } from './route';

/**
 * Edificio de dos pisos (coordenadas del plano en metros, y hacia abajo):
 *   piso 1: entrada (0,10) → (20,10) → (20,20) → escalera (30,20)
 *   piso 2: escalera (30,20) → (30,10) → puerta de CN-220 (10,10); el salón queda arriba (y 0–8).
 */
function building(): { data: CampusData; door: string; outside: string } {
  const data: CampusData = {
    version: 't', generatedAt: '', places: [],
    buildings: [{
      id: 'b', siglas: 'CN',
      anchor: { refLocal: [0, 10], refWorld: [-98.28, 19.05], rotationDeg: 0 },
      floors: [
        { level: 1, outline: [], rooms: [] },
        { level: 2, outline: [], rooms: [] },
      ],
    }],
    graph: { nodes: [], edges: [] },
  };
  const local = (level: number, xy: LocalXY) => ({ buildingId: 'b', level, xy });
  const outside = addNode(data, { kind: 'path', pos: [-98.2801, 19.05] });
  const chain = (ids: string[]) => ids.slice(1).forEach((id, i) => connect(data, ids[i], id));
  const entrance = addNode(data, { kind: 'entrance', local: local(1, [0, 10]), label: { es: 'por la puerta norte', en: 'through the north door' } });
  const f1 = [entrance, addNode(data, { kind: 'corridor', local: local(1, [20, 10]) }), addNode(data, { kind: 'corridor', local: local(1, [20, 20]) })];
  const s1 = addNode(data, { kind: 'stairs', local: local(1, [30, 20]) });
  const s2 = addNode(data, { kind: 'stairs', local: local(2, [30, 20]) });
  const door = addNode(data, { kind: 'door', local: local(2, [10, 10]) });
  chain([outside, ...f1, s1, s2, addNode(data, { kind: 'corridor', local: local(2, [30, 10]) }), door]);
  data.buildings[0].floors[1].rooms.push({ code: 'CN-220', polygon: [[5, 0], [15, 0], [15, 8], [5, 8]], doorNodeId: door });
  return { data, door, outside };
}

describe('buildIndoorLeg', () => {
  it('genera entrada, giros, escalera y llegada con el lado de la puerta', () => {
    const { data, door, outside } = building();
    const route = findRoute(data, { nodeId: outside }, [door])!;
    const leg = buildIndoorLeg(route, data)!;
    expect(leg.steps.map((s) => (s.kind === 'turn' ? `turn:${s.turn}` : s.kind === 'stairs' ? `stairs:${s.level}→${s.toLevel}` : s.kind))).toEqual([
      'enter', 'turn:right', 'turn:left', 'stairs:1→2', 'walk', 'turn:left', 'arrive',
    ]);
    expect(leg.steps.map((s) => Math.round(s.distanceM))).toEqual([20, 10, 10, 0, 10, 20, 0]);
    expect(leg.steps[0].landmark?.es).toBe('por la puerta norte');
    expect(leg.steps.at(-1)).toMatchObject({ side: 'right', level: 2 });
    expect(leg.room?.code).toBe('CN-220');
    expect([...leg.pathsByLevel.keys()]).toEqual([1, 2]);
  });

  it('no hay tramo interior si la ruta termina afuera', () => {
    const { data, outside } = building();
    const route = findRoute(data, { nodeId: outside }, [outside])!;
    expect(buildIndoorLeg(route, data)).toBeNull();
  });
});

describe('doorSide', () => {
  it('caminando hacia el este, un salón al sur (y mayor) queda a la derecha', () => {
    expect(doorSide([0, 10], [10, 10], [10, 15])).toBe('right');
    expect(doorSide([0, 10], [10, 10], [10, 5])).toBe('left');
    expect(doorSide([0, 10], [10, 10], [16, 10])).toBe('ahead');
  });
});
