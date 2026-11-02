import { explainQuery, parseRoomCode, type Explanation, type RoomCode } from './data/codes';
import { nodeWorld } from './data/graph';
import type { CampusData, CategoryId, LngLat, Place } from './data/types';
import { haversineM } from './geo';

export type SearchResult =
  | { type: 'room'; code: string; floor: number; building?: Place; location?: LngLat; doorNodeId?: string }
  | { type: 'place'; place: Place }
  /** El código es válido pero ese salón aún no se levantó: se ofrece ir a su edificio. */
  | { type: 'building'; code: RoomCode; place: Place };

export interface SearchOutcome {
  results: SearchResult[];
  explanation: Explanation | null;
}

const MAX_RESULTS = 20;

/** Minúsculas y sin acentos, para comparar "Ingenierias" con "Ingenierías". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

const compact = (s: string) => normalize(s).replace(/[\s-]/g, '');

function placeScore(q: string, place: Place): number {
  let best = 0;
  if (place.siglas) {
    const s = normalize(place.siglas);
    if (s === q) best = 90;
    else if (q.length <= 4 && s.startsWith(q)) best = 50;
  }
  for (const name of [place.name.es, place.name.en].map(normalize)) {
    if (name === q) best = Math.max(best, 95);
    else if (name.startsWith(q)) best = Math.max(best, 70);
    else if (name.split(/[\s/-]+/).some((w) => w.startsWith(q))) best = Math.max(best, 60);
    else if (q.length >= 3 && name.includes(q)) best = Math.max(best, 40);
  }
  return best;
}

export function buildingPlace(data: CampusData, buildingId: string): Place | undefined {
  return data.places.find((p) => p.buildingId === buildingId);
}

export function search(query: string, data: CampusData): SearchOutcome {
  const q = normalize(query);
  if (!q) return { results: [], explanation: null };
  const qc = compact(query);
  const scored: { r: SearchResult; score: number; label: string }[] = [];

  for (const b of data.buildings) {
    for (const f of b.floors) {
      for (const room of f.rooms) {
        const rc = compact(room.code);
        const score = rc === qc ? 100 : /\d/.test(qc) && rc.startsWith(qc) ? 80 : 0;
        if (!score) continue;
        const door = data.graph.nodes.find((n) => n.id === room.doorNodeId);
        const building = buildingPlace(data, b.id);
        scored.push({
          r: { type: 'room', code: room.code, floor: f.level, building, location: (door && nodeWorld(data, door)) ?? building?.location, doorNodeId: room.doorNodeId },
          score,
          label: room.code,
        });
      }
    }
  }

  const code = parseRoomCode(query);
  if (code && !scored.some((s) => s.score === 100)) {
    for (const place of data.places) {
      if (place.kind === 'building' && place.siglas?.toUpperCase() === code.siglas) {
        scored.push({ r: { type: 'building', code, place }, score: 85, label: place.name.es });
      }
    }
  }

  for (const place of data.places) {
    const score = placeScore(q, place);
    if (score) scored.push({ r: { type: 'place', place }, score, label: place.name.es });
  }

  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'es', { numeric: true }));
  return { results: scored.slice(0, MAX_RESULTS).map((s) => s.r), explanation: explainQuery(query, data.places) };
}

/** Lugares de una categoría: por distancia si se conoce la ubicación del usuario, si no por nombre. */
export function placesInCategory(category: CategoryId, data: CampusData, from?: LngLat): Place[] {
  const places = data.places.filter((p) => p.categories.includes(category));
  const dist = (p: Place) => (from && p.location ? haversineM(from, p.location) : Infinity);
  return places.sort((a, b) => dist(a) - dist(b) || a.name.es.localeCompare(b.name.es, 'es'));
}

/** Ubicación en el mapa de un resultado, si ya se levantó. */
export function resultLocation(r: SearchResult): LngLat | undefined {
  return r.type === 'room' ? r.location : r.place.location;
}
