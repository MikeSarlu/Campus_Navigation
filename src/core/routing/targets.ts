import type { CampusData } from '../data/types';
import type { SearchResult } from '../search';
import { nearestNodes } from './route';

/** Nodos del grafo donde puede terminar la ruta hacia un resultado de búsqueda. */
export function routeTargets(result: SearchResult, data: CampusData): string[] {
  if (result.type === 'room') return result.doorNodeId ? [result.doorNodeId] : [];
  const place = result.place;
  if (place.entranceNodeIds.length) return place.entranceNodeIds;
  return place.location ? nearestNodes(data, place.location) : [];
}
