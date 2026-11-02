import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CampusData } from './types';
import { validateCampus } from './validate';

const base = (): CampusData => ({
  version: 'test',
  generatedAt: '2026-11-01T00:00:00Z',
  places: [],
  buildings: [],
  graph: {
    nodes: [
      { id: 'door', kind: 'door' },
      { id: 'hall', kind: 'corridor' },
    ],
    edges: [{ from: 'door', to: 'hall', lengthM: 3, kind: 'indoor' }],
  },
});

const errors = (data: CampusData) => validateCampus(data).filter((i) => i.level === 'error').map((i) => i.message);

describe('validateCampus', () => {
  const withBuilding = (code: string, level: number) => {
    const data = base();
    data.graph.nodes.push({ id: 'in', kind: 'entrance', local: { buildingId: 'b', level: 1, xy: [0, 0] } });
    data.places.push({ id: 'p', siglas: 'CN', name: { es: 'p', en: 'p' }, kind: 'building', categories: [], location: [0, 0], entranceNodeIds: ['in'] });
    data.buildings.push({
      id: 'b', siglas: 'CN', anchor: { refLocal: [0, 0], refWorld: [0, 0], rotationDeg: 0 },
      floors: [{ level, outline: [], rooms: [{ code, polygon: [], doorNodeId: 'door' }] }],
    });
    return data;
  };

  it('detecta salones cuyo código no coincide con el piso', () => {
    const data = withBuilding('CN-220', 1);
    data.graph.edges.push({ from: 'in', to: 'hall', lengthM: 2, kind: 'indoor' });
    expect(errors(data)).toEqual(['CN-220 indica piso 2 pero está en el piso 1']);
  });

  it('detecta salones sin camino desde una entrada', () => {
    expect(errors(withBuilding('CN-120', 1))).toEqual(['CN-120: no hay camino desde una entrada del edificio']);
  });

  it('acepta un salón conectado a la entrada', () => {
    const data = withBuilding('CN-120', 1);
    data.graph.edges.push({ from: 'in', to: 'hall', lengthM: 2, kind: 'indoor' });
    expect(errors(data)).toEqual([]);
  });

  it('detecta aristas con nodos inexistentes', () => {
    const data = base();
    data.graph.edges.push({ from: 'hall', to: 'nowhere', lengthM: 2, kind: 'indoor' });
    expect(errors(data)).toEqual(['Arista hall→nowhere usa un nodo inexistente']);
  });

  it('el campus.json publicado no tiene errores', () => {
    const data = JSON.parse(readFileSync('public/data/campus.json', 'utf8')) as CampusData;
    expect(errors(data)).toEqual([]);
  });
});
