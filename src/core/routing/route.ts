import { nodeWorld } from '../data/graph';
import type { CampusData, EdgeKind, GraphNode, LngLat } from '../data/types';
import { haversineM } from '../geo';
import { toMeters } from './planar';

/** Velocidad de caminata para el tiempo estimado (se calibrará con las pruebas en campus). */
export const WALK_SPEED_MPS = 1.3;
/** Tiempo extra por piso de escaleras, además de su longitud. */
export const STAIRS_EXTRA_S_PER_FLOOR = 10;

export const START_ID = '__start__';

export interface RouteNode {
  id: string;
  node?: GraphNode; // ausente para el punto de partida virtual
  pos?: LngLat;
}

export interface Route {
  nodes: RouteNode[];
  /** Tipo de cada tramo: edges[i] une nodes[i] con nodes[i+1]. */
  edgeKinds: EdgeKind[];
  lengthM: number;
  /** Índice del primer nodo interior; la parte exterior va de 0 a ese índice. */
  indoorFrom: number;
  /** Coordenadas del tramo exterior (lo que se dibuja y sigue con GPS). */
  outdoorCoords: LngLat[];
  /** Longitud del tramo exterior, en metros. */
  outdoorLengthM: number;
  etaS: number;
}

interface Adjacent {
  to: string;
  lengthM: number;
  kind: EdgeKind;
}

function adjacencyWithLengths(data: CampusData): Map<string, Adjacent[]> {
  const adj = new Map<string, Adjacent[]>(data.graph.nodes.map((n) => [n.id, []]));
  for (const e of data.graph.edges) {
    adj.get(e.from)?.push({ to: e.to, lengthM: e.lengthM, kind: e.kind });
    adj.get(e.to)?.push({ to: e.from, lengthM: e.lengthM, kind: e.kind });
  }
  return adj;
}

/**
 * Punto de la red exterior más cercano a `pos`: proyecta sobre cada tramo exterior.
 * Devuelve los extremos del tramo y la distancia a cada uno, para unir ahí el inicio virtual.
 */
export function snapToNetwork(data: CampusData, pos: LngLat) {
  const byId = new Map(data.graph.nodes.map((n) => [n.id, n]));
  let best: { a: string; b: string; t: number; distM: number; point: LngLat; lenM: number } | null = null;
  for (const e of data.graph.edges) {
    if (e.kind !== 'outdoor' && e.kind !== 'entrance') continue;
    const pa = nodeWorld(data, byId.get(e.from)!);
    const pb = nodeWorld(data, byId.get(e.to)!);
    if (!pa || !pb) continue;
    const [ax, ay] = toMeters(pa, pos);
    const [bx, by] = toMeters(pb, pos);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const distM = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || distM < best.distM) {
      best = { a: e.from, b: e.to, t, distM, point: [pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])], lenM: e.lengthM };
    }
  }
  return best;
}

/** Nodos donde termina la ruta según el destino: puertas, entradas o el nodo más cercano al lugar. */
export function nearestNodes(data: CampusData, pos: LngLat, count = 1): string[] {
  return data.graph.nodes
    .flatMap((n) => {
      if (n.local) return [];
      const p = nodeWorld(data, n);
      return p ? [{ id: n.id, d: haversineM(p, pos) }] : [];
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.id);
}

/**
 * Ruta más corta (Dijkstra) desde una posición o un nodo hasta cualquiera de los destinos.
 * Devuelve null si no hay red de caminos o no hay conexión.
 */
export function findRoute(data: CampusData, from: LngLat | { nodeId: string }, targets: string[]): Route | null {
  if (!targets.length) return null;
  const adj = adjacencyWithLengths(data);
  const byId = new Map(data.graph.nodes.map((n) => [n.id, n]));

  let startId: string;
  let startPos: LngLat | undefined;
  if ('nodeId' in from) {
    startId = from.nodeId;
  } else {
    const snap = snapToNetwork(data, from);
    if (!snap) return null;
    startId = START_ID;
    startPos = from;
    // Inicio virtual unido a ambos extremos del tramo más cercano (más lo que hay que caminar hasta él).
    adj.set(START_ID, [
      { to: snap.a, lengthM: snap.distM + snap.t * snap.lenM, kind: 'outdoor' },
      { to: snap.b, lengthM: snap.distM + (1 - snap.t) * snap.lenM, kind: 'outdoor' },
    ]);
  }

  const targetSet = new Set(targets);
  const dist = new Map<string, number>([[startId, 0]]);
  const prev = new Map<string, { id: string; kind: EdgeKind }>();
  const done = new Set<string>();
  const queue: string[] = [startId];
  let reached: string | null = null;

  // El campus tiene cientos o pocos miles de nodos: una cola simple basta.
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (dist.get(queue[i])! < dist.get(queue[bi])!) bi = i;
    const id = queue.splice(bi, 1)[0];
    if (done.has(id)) continue;
    done.add(id);
    if (targetSet.has(id)) {
      reached = id;
      break;
    }
    for (const { to, lengthM, kind } of adj.get(id) ?? []) {
      const nd = dist.get(id)! + lengthM;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { id, kind });
        queue.push(to);
      }
    }
  }
  if (!reached) return null;

  const ids: string[] = [];
  const edgeKinds: EdgeKind[] = [];
  for (let id: string | undefined = reached; id; id = prev.get(id)?.id) {
    ids.unshift(id);
    const p = prev.get(id);
    if (p) edgeKinds.unshift(p.kind);
  }

  const nodes: RouteNode[] = ids.map((id) => {
    if (id === START_ID) return { id, pos: startPos };
    const node = byId.get(id)!;
    return { id, node, pos: nodeWorld(data, node) };
  });
  const firstIndoor = nodes.findIndex((n) => !!n.node?.local && n.node.kind !== 'entrance');
  const indoorFrom = firstIndoor === -1 ? nodes.length : firstIndoor;
  const outdoorCoords = nodes.slice(0, indoorFrom).flatMap((n) => (n.pos ? [n.pos] : []));
  let outdoorLengthM = 0;
  for (let i = 1; i < outdoorCoords.length; i++) outdoorLengthM += haversineM(outdoorCoords[i - 1], outdoorCoords[i]);

  const lengthM = dist.get(reached)!;
  const floors = edgeKinds.filter((k) => k === 'stairs').length;
  return {
    nodes,
    edgeKinds,
    lengthM,
    indoorFrom,
    outdoorCoords,
    outdoorLengthM,
    etaS: lengthM / WALK_SPEED_MPS + floors * STAIRS_EXTRA_S_PER_FLOOR,
  };
}
