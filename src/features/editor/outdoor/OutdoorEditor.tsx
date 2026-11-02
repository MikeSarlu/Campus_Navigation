import type { GeoJSONSource, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import type { LineString, Point } from 'geojson';
import type { LngLat, LocalXY } from '../../../core/data/types';
import { distanceXY, pointToSegment } from '../../../core/geo';
import { CAMPUS_CENTER } from '../../map/campusStyle';
import { maplibregl, maplibreReady } from '../../map/maplibre';
import styles from '../editor.module.css';
import { useEditor } from '../editorStore';
import { moveNode } from '../ops';
import { addEntrance, addPathPoint, deleteHit, setAnchorWorld, setPlaceLocation, type MapHit } from './outdoorActions';
import { edgesGeoJSON, nodesGeoJSON, outlinesGeoJSON } from './outdoorLayers';

export type Basemap = 'osm' | 'satellite';

// Teselas en línea solo para el editor. La app usará teselas propias (PMTiles) para funcionar sin conexión.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm' },
    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
  ],
};

const EMPTY = { type: 'FeatureCollection' as const, features: [] };

function addOverlayLayers(map: maplibregl.Map) {
  map.addSource('outlines', { type: 'geojson', data: EMPTY });
  map.addSource('edges', { type: 'geojson', data: EMPTY });
  map.addSource('nodes', { type: 'geojson', data: EMPTY });
  map.addSource('gps', { type: 'geojson', data: EMPTY });

  map.addLayer({
    id: 'outlines', type: 'line', source: 'outlines',
    paint: { 'line-color': ['case', ['get', 'selected'], '#ff6a00', '#732cc4'], 'line-width': 3, 'line-dasharray': [2, 1] },
  });
  map.addLayer({
    id: 'edges-casing', type: 'line', source: 'edges',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['case', ['get', 'selected'], 11, 8] },
  });
  map.addLayer({
    id: 'edges', type: 'line', source: 'edges',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': ['case', ['get', 'selected'], '#ff6a00', ['==', ['get', 'kind'], 'entrance'], '#086627', '#0040c1'],
      'line-width': ['case', ['get', 'selected'], 7, 4],
    },
  });
  map.addLayer({
    id: 'nodes', type: 'circle', source: 'nodes',
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 9, ['==', ['get', 'kind'], 'entrance'], 8, 5],
      'circle-color': ['case', ['get', 'selected'], '#ff6a00', ['==', ['get', 'kind'], 'entrance'], '#086627', '#0040c1'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'gps', type: 'circle', source: 'gps',
    paint: { 'circle-radius': 10, 'circle-color': '#1a73e8', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 },
  });
}

const HIT_PX = 12;

/**
 * Busca el nodo o tramo bajo el dedo usando los datos, no lo ya pintado: entre dos toques
 * rápidos el mapa puede no haber redibujado todavía el punto recién creado.
 */
function hitTest(map: maplibregl.Map, point: maplibregl.Point): MapHit {
  const { data } = useEditor.getState();
  if (!data) return null;
  const at: LocalXY = [point.x, point.y];
  const screen = (c: number[]): LocalXY => {
    const p = map.project(c as LngLat);
    return [p.x, p.y];
  };

  let best: { id: string; d: number } | null = null;
  for (const f of nodesGeoJSON(data, null, null).features) {
    const d = distanceXY(screen((f.geometry as Point).coordinates), at);
    if (d <= HIT_PX && (!best || d < best.d)) best = { id: f.properties!.id as string, d };
  }
  if (best) return { node: best.id };

  for (const f of edgesGeoJSON(data, null).features) {
    const [a, b] = (f.geometry as LineString).coordinates;
    if (pointToSegment(at, screen(a), screen(b)).dist <= HIT_PX) return { edge: [f.properties!.from as string, f.properties!.to as string] };
  }
  return null;
}

export function OutdoorEditor({ basemap, gpsPos }: { basemap: Basemap; gpsPos?: LngLat }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const markers = useRef<maplibregl.Marker[]>([]);
  // El mapa se crea de forma asíncrona: los efectos que lo usan se repiten cuando está listo.
  const [mapReady, setMapReady] = useState(false);

  const data = useEditor((s) => s.data);
  const selection = useEditor((s) => s.selection);
  const chainFrom = useEditor((s) => s.chainFrom);
  const buildingId = useEditor((s) => s.buildingId);

  // Crear el mapa una sola vez.
  useEffect(() => {
    // El mapa se crea cuando el worker de MapLibre está listo (ver maplibre.ts).
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void maplibreReady.then(() => {
      if (!cancelled) dispose = createMap();
    });
    return () => {
      cancelled = true;
      dispose?.();
    };

    function createMap() {
      const map = new maplibregl.Map({ container: container.current!, style: STYLE, center: CAMPUS_CENTER, zoom: 16.5, maxZoom: 21 });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        addOverlayLayers(map);
        loaded.current = true;
        refresh();
        setMapReady(true);
      });

      map.on('click', (e: MapMouseEvent) => {
        const pos: LngLat = [e.lngLat.lng, e.lngLat.lat];
        const hit = hitTest(map, e.point);
        const s = useEditor.getState();
        switch (s.outdoorTool) {
          case 'select':
            if (!hit) s.select(null);
            else if ('node' in hit) s.select({ type: 'node', id: hit.node });
            else s.select({ type: 'edge', from: hit.edge[0], to: hit.edge[1] });
            break;
          case 'path':
            addPathPoint(pos, hit);
            break;
          case 'place':
            setPlaceLocation(pos);
            break;
          case 'entrance':
            addEntrance(pos, hit);
            break;
          case 'anchor':
            setAnchorWorld(pos);
            break;
          case 'delete':
            deleteHit(hit);
            break;
        }
      });

      // Arrastrar nodos exteriores con la herramienta de selección.
      let dragging: string | null = null;
      const onDown = (e: maplibregl.MapLayerMouseEvent | maplibregl.MapLayerTouchEvent) => {
        const f = e.features?.[0];
        if (useEditor.getState().outdoorTool !== 'select' || !f?.properties.draggable) return;
        e.preventDefault();
        dragging = f.properties.id as string;
        useEditor.getState().select({ type: 'node', id: dragging });
        map.getCanvas().style.cursor = 'grabbing';
      };
      const onMove = (e: { lngLat: maplibregl.LngLat }) => {
        if (!dragging) return;
        const d = structuredClone(useEditor.getState().data!);
        moveNode(d, dragging, { pos: [e.lngLat.lng, e.lngLat.lat] });
        (map.getSource('nodes') as GeoJSONSource).setData(nodesGeoJSON(d, useEditor.getState().selection, null));
        (map.getSource('edges') as GeoJSONSource).setData(edgesGeoJSON(d, null));
      };
      const onUp = (e: { lngLat: maplibregl.LngLat }) => {
        if (!dragging) return;
        const id = dragging;
        dragging = null;
        map.getCanvas().style.cursor = '';
        useEditor.getState().commit((d) => moveNode(d, id, { pos: [e.lngLat.lng, e.lngLat.lat] }));
      };
      map.on('mousedown', 'nodes', onDown);
      map.on('touchstart', 'nodes', onDown);
      map.on('mousemove', onMove);
      map.on('touchmove', onMove);
      map.on('mouseup', onUp);
      map.on('touchend', onUp);

      return () => {
        loaded.current = false;
        map.remove();
        mapRef.current = null;
      };
    }
  }, []);

  function refresh() {
    const map = mapRef.current;
    const s = useEditor.getState();
    if (!map || !loaded.current || !s.data) return;
    (map.getSource('nodes') as GeoJSONSource).setData(nodesGeoJSON(s.data, s.selection, s.chainFrom));
    (map.getSource('edges') as GeoJSONSource).setData(edgesGeoJSON(s.data, s.selection));
    (map.getSource('outlines') as GeoJSONSource).setData(outlinesGeoJSON(s.data, s.buildingId));
  }

  useEffect(refresh, [data, selection, chainFrom, buildingId]);

  // Marcadores de lugares (HTML: no requieren fuentes de texto en el estilo).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    markers.current.forEach((m) => m.remove());
    markers.current = data.places.flatMap((p) => {
      if (!p.location) return [];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = styles.placeMarker;
      if (selection?.type === 'place' && selection.id === p.id) el.dataset.selected = 'true';
      el.textContent = p.siglas ?? p.name.es;
      el.title = p.name.es;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        useEditor.getState().select({ type: 'place', id: p.id });
      });
      return [new maplibregl.Marker({ element: el }).setLngLat(p.location).addTo(map)];
    });
  }, [data, selection, mapReady]);

  // Centrar el mapa en el lugar seleccionado.
  useEffect(() => {
    if (selection?.type !== 'place') return;
    const loc = useEditor.getState().data?.places.find((p) => p.id === selection.id)?.location;
    if (loc) mapRef.current?.easeTo({ center: loc, zoom: Math.max(mapRef.current.getZoom(), 18) });
  }, [selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      map.setLayoutProperty('osm', 'visibility', basemap === 'osm' ? 'visible' : 'none');
      map.setLayoutProperty('satellite', 'visibility', basemap === 'satellite' ? 'visible' : 'none');
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    (map.getSource('gps') as GeoJSONSource).setData(
      gpsPos ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: gpsPos }, properties: {} }] } : EMPTY,
    );
    if (gpsPos) map.easeTo({ center: gpsPos, zoom: Math.max(map.getZoom(), 18) });
  }, [gpsPos, mapReady]);

  return <div ref={container} className={styles.canvas} />;
}
