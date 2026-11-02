import type { StyleSpecification } from 'maplibre-gl';

/** Área cubierta por las teselas locales (oeste, sur, este, norte). Ver scripts/fetch-tiles.mjs. */
export const CAMPUS_BBOX: [number, number, number, number] = [-98.2965, 19.044, -98.27, 19.0635];
export const CAMPUS_CENTER: [number, number] = [-98.2833, 19.0546];

// Colores desaturados para que la ruta azul y los marcadores dominen bajo el sol (docs/DISENO.md §7).
const C = {
  ground: '#f1f1ec',
  campus: '#e9e8e0',
  green: '#cfe0c5',
  pitch: '#b9d4ab',
  water: '#8fbde3',
  building: '#c4c4be',
  buildingLine: '#4d4d49',
  road: '#ffffff',
  roadCasing: '#8c8c86',
  path: '#3d3d3a',
  text: '#0b0b0b',
};

const GREEN_KINDS = ['grass', 'park', 'garden', 'meadow', 'grassland', 'forest', 'recreation_ground', 'playground', 'scrub'];
const PATH_KINDS = ['footway', 'pedestrian', 'path', 'crossing', 'steps', 'cycleway'];

/** Estilo del mapa. Usa el protocolo campus:// (ver maplibre.ts) para funcionar sin conexión. */
export function campusStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'campus://fonts/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'vector',
        tiles: ['campus://tiles/{z}/{x}/{y}.mvt'],
        minzoom: 0,
        maxzoom: 15,
        bounds: CAMPUS_BBOX,
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': C.ground } },
      {
        id: 'campus', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['university', 'school', 'college']]],
        paint: { 'fill-color': C.campus },
      },
      {
        id: 'green', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', GREEN_KINDS]],
        paint: { 'fill-color': C.green },
      },
      {
        id: 'pitch', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: ['==', ['get', 'kind'], 'pitch'],
        paint: { 'fill-color': C.pitch, 'fill-outline-color': '#7f9c72' },
      },
      { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': C.water } },
      {
        id: 'roads-casing', type: 'line', source: 'osm', 'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['major_road', 'minor_road', 'highway', 'other']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.roadCasing,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 3, 17, 10, 20, 40],
        },
      },
      {
        id: 'roads', type: 'line', source: 'osm', 'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['major_road', 'minor_road', 'highway', 'other']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.road,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 1.5, 17, 7, 20, 34],
        },
      },
      {
        id: 'paths', type: 'line', source: 'osm', 'source-layer': 'roads',
        filter: ['in', ['get', 'kind_detail'], ['literal', PATH_KINDS]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.path,
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1, 18, 2.5, 20, 5],
          'line-dasharray': ['case', ['==', ['get', 'kind_detail'], 'steps'], ['literal', [0.5, 0.5]], ['literal', [2, 1.5]]],
        },
      },
      {
        id: 'buildings', type: 'fill', source: 'osm', 'source-layer': 'buildings',
        filter: ['==', ['get', 'kind'], 'building'],
        paint: { 'fill-color': C.building },
      },
      {
        id: 'buildings-outline', type: 'line', source: 'osm', 'source-layer': 'buildings',
        filter: ['==', ['get', 'kind'], 'building'],
        paint: { 'line-color': C.buildingLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.5, 19, 1.5] },
      },
      {
        id: 'road-labels', type: 'symbol', source: 'osm', 'source-layer': 'roads',
        filter: ['all', ['has', 'name'], ['in', ['get', 'kind'], ['literal', ['major_road', 'minor_road']]]],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
        },
        paint: { 'text-color': '#2b2b29', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      },
    ],
  };
}
