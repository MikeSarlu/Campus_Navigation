import { distanceXY, haversineM, localToLngLat } from '../geo';
import type { CampusData, EdgeKind, GraphNode, LngLat } from './types';

/** Longitud asignada a un tramo de escaleras por cada piso que sube o baja. */
export const STAIRS_M_PER_FLOOR = 8;

/** Posición geográfica de un nodo: la propia (exterior) o la calculada desde el ancla del edificio. */
export function nodeWorld(data: CampusData, node: GraphNode): LngLat | undefined {
  if (node.pos) return node.pos;
  if (!node.local) return undefined;
  const anchor = data.buildings.find((b) => b.id === node.local!.buildingId)?.anchor;
  return anchor ? localToLngLat(node.local.xy, anchor) : undefined;
}

export function edgeKind(a: GraphNode, b: GraphNode): EdgeKind {
  if (a.local && b.local) return a.local.level === b.local.level ? 'indoor' : 'stairs';
  if (a.kind === 'entrance' || b.kind === 'entrance') return 'entrance';
  return 'outdoor';
}

export function edgeLength(data: CampusData, a: GraphNode, b: GraphNode): number {
  if (a.local && b.local && a.local.buildingId === b.local.buildingId) {
    const floors = Math.abs(a.local.level - b.local.level);
    return floors ? floors * STAIRS_M_PER_FLOOR : distanceXY(a.local.xy, b.local.xy);
  }
  const pa = nodeWorld(data, a);
  const pb = nodeWorld(data, b);
  // Sin ancla todavía no hay distancia real; 1 m mantiene la arista válida hasta anclar.
  return pa && pb ? haversineM(pa, pb) : 1;
}

export function adjacency(data: CampusData): Map<string, string[]> {
  const adj = new Map<string, string[]>(data.graph.nodes.map((n) => [n.id, []]));
  for (const e of data.graph.edges) {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }
  return adj;
}

/** Nodos alcanzables desde cualquiera de los de inicio (el grafo es no dirigido). */
export function reachableFrom(adj: Map<string, string[]>, start: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const stack = [...start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of adj.get(id) ?? []) if (!seen.has(next)) stack.push(next);
  }
  return seen;
}
