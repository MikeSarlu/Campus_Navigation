// Acciones del modo interior sobre el piso activo (coordenadas locales en metros).
import { parseRoomCode } from '../../../core/data/codes';
import type { LocalXY } from '../../../core/data/types';
import { distanceXY } from '../../../core/geo';
import { useEditor } from '../editorStore';
import { addNode, connect, removeEdge, removeNode, splitEdge } from '../ops';

export type PlanHit = { node: string } | { edge: [string, string] } | { room: string } | null;

const state = () => useEditor.getState();

function floorRef() {
  const { buildingId, level } = state();
  return buildingId && level !== null ? { buildingId, level } : null;
}

/** Agrega un punto al pasillo en curso (mismo comportamiento que "Camino" en exteriores). */
export function addCorridorPoint(xy: LocalXY, hit: PlanHit): void {
  const ref = floorRef();
  const { chainFrom, commit, set } = state();
  if (!ref) return;
  if (hit && 'node' in hit && hit.node === chainFrom) {
    set({ chainFrom: null });
    return;
  }
  if (hit && 'node' in hit && !chainFrom) {
    set({ chainFrom: hit.node });
    return;
  }
  let id = '';
  commit((d) => {
    if (hit && 'node' in hit) id = hit.node;
    else if (hit && 'edge' in hit) id = splitEdge(d, hit.edge[0], hit.edge[1], { kind: 'corridor', local: { ...ref, xy } });
    else id = addNode(d, { kind: 'corridor', local: { ...ref, xy } });
    if (chainFrom) connect(d, chainFrom, id);
  });
  set({ chainFrom: id });
}

/** Coloca un nodo especial (escalera, elevador, entrada), unido al pasillo si se tocó uno. */
export function addSpecialNode(kind: 'stairs' | 'elevator' | 'entrance', xy: LocalXY, hit: PlanHit): void {
  const ref = floorRef();
  if (!ref) return;
  let id = '';
  state().commit((d) => {
    id = hit && 'edge' in hit
      ? splitEdge(d, hit.edge[0], hit.edge[1], { kind, local: { ...ref, xy } })
      : addNode(d, { kind, local: { ...ref, xy } });
    if (kind === 'entrance') {
      for (const p of d.places) if (p.buildingId === ref.buildingId) p.entranceNodeIds.push(id);
    }
  });
  state().select({ type: 'node', id });
}

/** Cierra el polígono en curso: contorno del piso, o salón (que luego pide código y puerta). */
export function closePolygon(kind: 'outline' | 'room'): void {
  const { draft, commit, set, buildingId, level } = state();
  if (draft.length < 3) return;
  if (kind === 'room') {
    set({ pendingRoom: draft, draft: [] });
    return;
  }
  commit((d) => {
    const floor = d.buildings.find((b) => b.id === buildingId)?.floors.find((f) => f.level === level);
    if (floor) floor.outline = draft;
  });
  set({ draft: [] });
}

export function roomCodeError(code: string): string | null {
  const { data, buildingId, level } = state();
  const b = data?.buildings.find((x) => x.id === buildingId);
  const parsed = parseRoomCode(code);
  if (!b || level === null) return 'Elige un edificio y piso.';
  if (!parsed) return 'Formato esperado: SIGLAS-NÚMERO (p. ej. CN-220).';
  if (parsed.siglas !== b.siglas) return `Las siglas deben ser ${b.siglas}.`;
  if (parsed.floor !== level) return `El primer dígito indica piso ${parsed.floor}, pero estás en el piso ${level}.`;
  if (b.floors.some((f) => f.rooms.some((r) => r.code === parsed.code))) return `${parsed.code} ya existe.`;
  return null;
}

/** Guarda el salón pendiente; queda esperando que se coloque su puerta. */
export function saveRoom(code: string): void {
  const { pendingRoom, set } = state();
  const parsed = parseRoomCode(code);
  if (!pendingRoom || !parsed || roomCodeError(code)) return;
  state().setIndoorTool('door'); // limpia el dibujo en curso
  set({ pendingDoorFor: parsed.code, draft: pendingRoom });
}

/**
 * Coloca la puerta del salón pendiente y la une al nodo de pasillo más cercano del piso.
 * El polígono del salón viaja en `draft` mientras se elige la puerta.
 */
export function placeDoor(xy: LocalXY, hit: PlanHit): void {
  const ref = floorRef();
  const { pendingDoorFor, draft, commit, set, select } = state();
  if (!ref || !pendingDoorFor) return;
  commit((d) => {
    const floor = d.buildings.find((b) => b.id === ref.buildingId)?.floors.find((f) => f.level === ref.level);
    if (!floor) return;
    const door = hit && 'edge' in hit
      ? splitEdge(d, hit.edge[0], hit.edge[1], { kind: 'door', local: { ...ref, xy } })
      : addNode(d, { kind: 'door', local: { ...ref, xy } });
    if (!(hit && 'edge' in hit)) {
      const nearest = d.graph.nodes
        .filter((n) => n.id !== door && n.kind === 'corridor' && n.local?.buildingId === ref.buildingId && n.local.level === ref.level)
        .sort((a, b) => distanceXY(a.local!.xy, xy) - distanceXY(b.local!.xy, xy))[0];
      if (nearest) connect(d, door, nearest.id);
    }
    floor.rooms.push({ code: pendingDoorFor, polygon: draft, doorNodeId: door });
  });
  set({ pendingDoorFor: null, draft: [] });
  state().setIndoorTool('room');
  select({ type: 'room', code: pendingDoorFor });
}

export function deletePlanHit(hit: PlanHit): void {
  if (!hit) return;
  const { buildingId, level, commit, select } = state();
  commit((d) => {
    if ('node' in hit) removeNode(d, hit.node);
    else if ('edge' in hit) removeEdge(d, hit.edge[0], hit.edge[1]);
    else {
      const floor = d.buildings.find((b) => b.id === buildingId)?.floors.find((f) => f.level === level);
      const room = floor?.rooms.find((r) => r.code === hit.room);
      if (room) removeNode(d, room.doorNodeId); // también borra el salón
    }
  });
  select(null);
}
