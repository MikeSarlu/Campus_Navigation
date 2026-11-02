// Modelo de datos del campus. Lo comparten la app y el editor (docs/DISENO.md §5).

export type LngLat = [lng: number, lat: number];
export type LocalXY = [x: number, y: number]; // metros, relativos al ancla del edificio

export interface Localized {
  es: string;
  en: string;
}

export type PlaceKind = 'building' | 'service' | 'sports' | 'residence' | 'garden' | 'parking';

export type CategoryId = 'comedor' | 'gimnasio' | 'medico' | 'escolares' | 'biblioteca' | 'internacional';

/** Cualquier cosa que se puede buscar. Las siglas pueden repetirse entre lugares. */
export interface Place {
  id: string;
  siglas?: string;
  name: Localized;
  kind: PlaceKind;
  categories: CategoryId[];
  /** Ausente mientras el lugar no se haya levantado en campo. */
  location?: LngLat;
  entranceNodeIds: string[];
  buildingId?: string;
}

/**
 * Ubica el plano local en el mapa: el punto `refLocal` del plano está en `refWorld`, y
 * el "arriba" del plano (−y) apunta `rotationDeg` grados al este del norte.
 */
export interface Anchor {
  refLocal: LocalXY;
  refWorld: LngLat;
  rotationDeg: number;
}

export interface Building {
  id: string;
  siglas: string;
  anchor?: Anchor;
  floors: Floor[];
}

export interface Floor {
  level: number;
  outline: LocalXY[];
  rooms: Room[];
}

export interface Room {
  code: string;
  polygon: LocalXY[];
  doorNodeId: string;
}

export type NodeKind = 'path' | 'entrance' | 'corridor' | 'stairs' | 'elevator' | 'door';

export interface GraphNode {
  id: string;
  pos?: LngLat;
  local?: { buildingId: string; level: number; xy: LocalXY };
  kind: NodeKind;
  label?: Localized;
}

export type EdgeKind = 'outdoor' | 'indoor' | 'stairs' | 'entrance';

export interface GraphEdge {
  from: string;
  to: string;
  lengthM: number;
  kind: EdgeKind;
}

export interface CampusData {
  version: string;
  generatedAt: string;
  places: Place[];
  buildings: Building[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}
