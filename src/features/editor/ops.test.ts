import { describe, expect, it } from 'vitest';
import type { CampusData } from '../../core/data/types';
import { addNode, connect, moveNode, removeNode, splitEdge } from './ops';

const empty = (): CampusData => ({
  version: 't', generatedAt: '', places: [], buildings: [], graph: { nodes: [], edges: [] },
});

describe('operaciones del editor', () => {
  it('conecta nodos interiores con su distancia en metros, sin duplicar', () => {
    const d = empty();
    const a = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [0, 0] } });
    const b = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [3, 4] } });
    connect(d, a, b);
    connect(d, b, a);
    expect(d.graph.edges).toEqual([{ from: a, to: b, lengthM: 5, kind: 'indoor' }]);
  });

  it('las escaleras entre pisos usan la longitud fija por piso', () => {
    const d = empty();
    const a = addNode(d, { kind: 'stairs', local: { buildingId: 'b', level: 1, xy: [0, 0] } });
    const b = addNode(d, { kind: 'stairs', local: { buildingId: 'b', level: 3, xy: [0, 0] } });
    connect(d, a, b);
    expect(d.graph.edges[0]).toMatchObject({ kind: 'stairs', lengthM: 16 });
  });

  it('splitEdge crea un cruce y conserva la conexión', () => {
    const d = empty();
    const a = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [0, 0] } });
    const b = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [10, 0] } });
    connect(d, a, b);
    const m = splitEdge(d, a, b, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [4, 0] } });
    expect(d.graph.edges.map((e) => [e.from, e.to, e.lengthM])).toEqual([[a, m, 4], [m, b, 6]]);
  });

  it('moveNode recalcula las aristas que lo tocan', () => {
    const d = empty();
    const a = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [0, 0] } });
    const b = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 1, xy: [1, 0] } });
    connect(d, a, b);
    moveNode(d, b, { xy: [0, 7] });
    expect(d.graph.edges[0].lengthM).toBe(7);
  });

  it('removeNode limpia aristas, entradas y el salón de esa puerta', () => {
    const d = empty();
    const door = addNode(d, { kind: 'door', local: { buildingId: 'b', level: 2, xy: [0, 0] } });
    const hall = addNode(d, { kind: 'corridor', local: { buildingId: 'b', level: 2, xy: [1, 0] } });
    connect(d, door, hall);
    d.places.push({ id: 'p', name: { es: 'p', en: 'p' }, kind: 'building', categories: [], entranceNodeIds: [door] });
    d.buildings.push({ id: 'b', siglas: 'CN', floors: [{ level: 2, outline: [], rooms: [{ code: 'CN-220', polygon: [], doorNodeId: door }] }] });
    removeNode(d, door);
    expect(d.graph.edges).toEqual([]);
    expect(d.places[0].entranceNodeIds).toEqual([]);
    expect(d.buildings[0].floors[0].rooms).toEqual([]);
  });
});
