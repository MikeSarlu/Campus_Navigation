// Operaciones de edición sobre un borrador de CampusData. Todas mutan `d`; el store
// se encarga de clonar antes y guardar el historial para deshacer.
import { edgeKind, edgeLength } from '../../core/data/graph';
import type { CampusData, GraphNode, LngLat, LocalXY } from '../../core/data/types';

export function newId(prefix: string): string {
  // crypto.randomUUID solo existe con https o localhost (no al abrir el editor por la red local).
  const random = crypto.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${prefix}-${random}`;
}

export function getNode(d: CampusData, id: string): GraphNode | undefined {
  return d.graph.nodes.find((n) => n.id === id);
}

export function addNode(d: CampusData, node: Omit<GraphNode, 'id'>): string {
  const id = newId('n');
  d.graph.nodes.push({ id, ...node });
  return id;
}

function hasEdge(d: CampusData, a: string, b: string) {
  return d.graph.edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
}

export function connect(d: CampusData, a: string, b: string): void {
  const na = getNode(d, a);
  const nb = getNode(d, b);
  if (!na || !nb || a === b || hasEdge(d, a, b)) return;
  d.graph.edges.push({ from: a, to: b, lengthM: edgeLength(d, na, nb), kind: edgeKind(na, nb) });
}

export function removeEdge(d: CampusData, a: string, b: string): void {
  d.graph.edges = d.graph.edges.filter((e) => !((e.from === a && e.to === b) || (e.from === b && e.to === a)));
}

/** Borra el nodo, sus aristas, su uso como entrada y el salón cuya puerta era. */
export function removeNode(d: CampusData, id: string): void {
  d.graph.nodes = d.graph.nodes.filter((n) => n.id !== id);
  d.graph.edges = d.graph.edges.filter((e) => e.from !== id && e.to !== id);
  for (const p of d.places) p.entranceNodeIds = p.entranceNodeIds.filter((n) => n !== id);
  for (const b of d.buildings) for (const f of b.floors) f.rooms = f.rooms.filter((r) => r.doorNodeId !== id);
}

/** Inserta un nodo nuevo a la mitad de una arista existente (para hacer cruces en "T"). */
export function splitEdge(d: CampusData, a: string, b: string, node: Omit<GraphNode, 'id'>): string {
  removeEdge(d, a, b);
  const id = addNode(d, node);
  connect(d, a, id);
  connect(d, id, b);
  return id;
}

export function moveNode(d: CampusData, id: string, to: { pos: LngLat } | { xy: LocalXY }): void {
  const node = getNode(d, id);
  if (!node) return;
  if ('pos' in to) node.pos = to.pos;
  else if (node.local) node.local.xy = to.xy;
  recomputeLengths(d, id);
}

/** Recalcula longitudes y tipos de las aristas (todas, o solo las que tocan `onlyNode`). */
export function recomputeLengths(d: CampusData, onlyNode?: string): void {
  const byId = new Map(d.graph.nodes.map((n) => [n.id, n]));
  for (const e of d.graph.edges) {
    if (onlyNode && e.from !== onlyNode && e.to !== onlyNode) continue;
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    e.lengthM = edgeLength(d, a, b);
    e.kind = edgeKind(a, b);
  }
}
