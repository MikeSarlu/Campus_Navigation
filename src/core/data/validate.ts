import { parseRoomCode } from './codes';
import { adjacency, reachableFrom } from './graph';
import type { CampusData } from './types';

export interface Issue {
  level: 'error' | 'warning';
  message: string;
}

/** Revisa la consistencia de campus.json. La usan el editor (antes de exportar) y la app (al cargar). */
export function validateCampus(data: CampusData): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });

  const placeIds = new Set<string>();
  for (const p of data.places) {
    if (placeIds.has(p.id)) error(`Lugar duplicado: ${p.id}`);
    placeIds.add(p.id);
    if (!p.location) warn(`Sin ubicación levantada: ${p.name.es}`);
  }

  const nodeIds = new Set(data.graph.nodes.map((n) => n.id));
  if (nodeIds.size !== data.graph.nodes.length) error('Hay nodos con id duplicado');

  for (const p of data.places) {
    for (const id of p.entranceNodeIds) {
      if (!nodeIds.has(id)) error(`${p.name.es}: entrada ${id} no existe en el grafo`);
    }
  }

  for (const e of data.graph.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) error(`Arista ${e.from}→${e.to} usa un nodo inexistente`);
    if (!(e.lengthM > 0)) error(`Arista ${e.from}→${e.to} sin longitud`);
  }

  const adj = adjacency(data);
  const seenCodes = new Set<string>();

  for (const b of data.buildings) {
    if (b.floors.length && !b.anchor) error(`Edificio ${b.siglas} tiene pisos pero no está anclado al mapa`);
    const entrances = data.graph.nodes.filter((n) => n.kind === 'entrance' && n.local?.buildingId === b.id);
    if (b.floors.length && !entrances.length) error(`Edificio ${b.siglas} no tiene entradas marcadas`);
    const reachable = reachableFrom(adj, entrances.map((n) => n.id));

    for (const f of b.floors) {
      for (const r of f.rooms) {
        if (seenCodes.has(r.code)) error(`Salón repetido: ${r.code}`);
        seenCodes.add(r.code);
        const code = parseRoomCode(r.code);
        if (!code) error(`Código inválido: ${r.code}`);
        else if (code.siglas !== b.siglas) error(`${r.code} está en el edificio ${b.siglas}`);
        else if (code.floor !== f.level) error(`${r.code} indica piso ${code.floor} pero está en el piso ${f.level}`);
        if (!nodeIds.has(r.doorNodeId)) error(`${r.code}: la puerta ${r.doorNodeId} no existe en el grafo`);
        else if (entrances.length && !reachable.has(r.doorNodeId)) error(`${r.code}: no hay camino desde una entrada del edificio`);
      }
    }
  }

  for (const n of data.graph.nodes) {
    const degree = adj.get(n.id)?.length ?? 0;
    if (degree === 0) warn(`Nodo suelto (${n.kind}): ${n.id}`);
    if (n.kind === 'stairs' && !data.graph.edges.some((e) => e.kind === 'stairs' && (e.from === n.id || e.to === n.id))) {
      warn(`Escalera sin conectar a otro piso: ${n.id}`);
    }
    if (n.kind === 'entrance' && !data.places.some((p) => p.entranceNodeIds.includes(n.id))) {
      warn(`Entrada sin lugar asignado: ${n.id}`);
    }
  }

  return issues;
}
