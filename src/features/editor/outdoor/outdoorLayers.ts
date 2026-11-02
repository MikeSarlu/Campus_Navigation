import type { FeatureCollection } from 'geojson';
import { nodeWorld } from '../../../core/data/graph';
import { localToLngLat } from '../../../core/geo';
import type { CampusData, LngLat } from '../../../core/data/types';
import type { Selection } from '../editorStore';

/** Nodos que se ven en el mapa exterior: los exteriores y las entradas de edificios anclados. */
export function nodesGeoJSON(data: CampusData, selection: Selection, chainFrom: string | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.graph.nodes.flatMap((n) => {
      if (n.local && n.kind !== 'entrance') return [];
      const pos = nodeWorld(data, n);
      if (!pos) return [];
      const selected = (selection?.type === 'node' && selection.id === n.id) || chainFrom === n.id;
      return [{
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: pos },
        properties: { id: n.id, kind: n.kind, selected, draggable: !n.local },
      }];
    }),
  };
}

export function edgesGeoJSON(data: CampusData, selection: Selection): FeatureCollection {
  const byId = new Map(data.graph.nodes.map((n) => [n.id, n]));
  return {
    type: 'FeatureCollection',
    features: data.graph.edges.flatMap((e) => {
      if (e.kind === 'indoor' || e.kind === 'stairs') return [];
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      const pa = a && nodeWorld(data, a);
      const pb = b && nodeWorld(data, b);
      if (!pa || !pb) return [];
      const selected = selection?.type === 'edge' && selection.from === e.from && selection.to === e.to;
      return [{
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: [pa, pb] },
        properties: { from: e.from, to: e.to, kind: e.kind, selected },
      }];
    }),
  };
}

/** Contorno del piso más bajo de cada edificio anclado, para revisar la alineación con el mapa. */
export function outlinesGeoJSON(data: CampusData, selectedBuilding: string | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.buildings.flatMap((b) => {
      if (!b.anchor) return [];
      const floor = [...b.floors].sort((x, y) => x.level - y.level).find((f) => f.outline.length >= 3);
      if (!floor) return [];
      const ring: LngLat[] = floor.outline.map((xy) => localToLngLat(xy, b.anchor!));
      return [{
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [[...ring, ring[0]]] },
        properties: { id: b.id, selected: b.id === selectedBuilding },
      }];
    }),
  };
}
