// Acciones del modo exterior. Las usan tanto el clic en el mapa como "Marcar con GPS".
import type { LngLat } from '../../../core/data/types';
import { useEditor } from '../editorStore';
import { addNode, connect, getNode, recomputeLengths, removeEdge, removeNode, splitEdge } from '../ops';

export type MapHit = { node: string } | { edge: [string, string] } | null;

const state = () => useEditor.getState();

/** Agrega un punto al camino en curso, reutilizando el nodo o la arista que se tocó. */
export function addPathPoint(pos: LngLat, hit: MapHit): void {
  const { chainFrom, commit, set } = state();
  if (hit && 'node' in hit && hit.node === chainFrom) {
    set({ chainFrom: null }); // tocar el último punto termina el camino
    return;
  }
  if (hit && 'node' in hit && !chainFrom) {
    set({ chainFrom: hit.node }); // empezar desde un punto existente no cambia los datos
    return;
  }
  let id = '';
  commit((d) => {
    if (hit && 'node' in hit) id = hit.node;
    else if (hit && 'edge' in hit) id = splitEdge(d, hit.edge[0], hit.edge[1], { kind: 'path', pos });
    else id = addNode(d, { kind: 'path', pos });
    if (chainFrom) connect(d, chainFrom, id);
  });
  set({ chainFrom: id });
}

export function setPlaceLocation(pos: LngLat): boolean {
  const { selection, commit } = state();
  if (selection?.type !== 'place') return false;
  commit((d) => {
    const place = d.places.find((p) => p.id === selection.id);
    if (place) place.location = pos;
  });
  return true;
}

/** Marca una entrada del lugar seleccionado: un nodo existente o uno nuevo en `pos`. */
export function addEntrance(pos: LngLat, hit: MapHit): boolean {
  const { selection, commit } = state();
  if (selection?.type !== 'place') return false;
  commit((d) => {
    const place = d.places.find((p) => p.id === selection.id);
    if (!place) return;
    let id: string;
    if (hit && 'node' in hit) {
      id = hit.node;
      const node = getNode(d, id);
      if (node && !node.local) node.kind = 'entrance';
      recomputeLengths(d, id);
    } else {
      id = addNode(d, { kind: 'entrance', pos });
    }
    if (!place.entranceNodeIds.includes(id)) place.entranceNodeIds.push(id);
  });
  return true;
}

/** Coloca en el mapa el punto de referencia del plano del edificio seleccionado. */
export function setAnchorWorld(pos: LngLat): boolean {
  const { buildingId, pendingRef, commit, set } = state();
  if (!buildingId) return false;
  let ok = false;
  commit((d) => {
    const b = d.buildings.find((x) => x.id === buildingId);
    const refLocal = pendingRef ?? b?.anchor?.refLocal;
    if (!b || !refLocal) return;
    b.anchor = { refLocal, refWorld: pos, rotationDeg: b.anchor?.rotationDeg ?? 0 };
    recomputeLengths(d);
    ok = true;
  });
  if (ok) set({ pendingRef: null });
  return ok;
}

export function deleteHit(hit: MapHit): void {
  if (!hit) return;
  state().commit((d) => {
    if ('node' in hit) removeNode(d, hit.node);
    else removeEdge(d, hit.edge[0], hit.edge[1]);
  });
  state().select(null);
}
