import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useApp, useT } from '../../app/store';
import type { CampusData, LngLat, PlaceKind } from '../../core/data/types';
import { resultLocation } from '../../core/search';
import { resultTitle } from '../search/resultText';
import { CAMPUS_BBOX, CAMPUS_CENTER, campusStyle } from './campusStyle';
import { maplibregl } from './maplibre';
import styles from './map.module.css';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const point = (coordinates: LngLat, properties: Record<string, unknown> = {}): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates }, properties }],
});

// Menor número = más prioridad cuando las etiquetas chocan.
const PRIORITY: Record<PlaceKind, number> = { building: 0, service: 1, sports: 2, residence: 2, garden: 3, parking: 5 };

function placesGeoJSON(data: CampusData, lang: 'es' | 'en'): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.places.flatMap((p) =>
      p.location
        ? [{
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: p.location },
            properties: { id: p.id, short: p.siglas ?? p.name[lang], name: p.name[lang], priority: PRIORITY[p.kind] },
          }]
        : [],
    ),
  };
}

/** Cono de orientación del punto azul, dibujado una vez en un canvas. */
function coneImage(): ImageData {
  const size = 96;
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.canvas.width = ctx.canvas.height = size;
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(26,115,232,0.55)');
  grad.addColorStop(1, 'rgba(26,115,232,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, c, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function addLayers(map: MapLibreMap) {
  for (const id of ['places', 'destination', 'user']) map.addSource(id, { type: 'geojson', data: EMPTY });
  map.addImage('heading-cone', coneImage(), { pixelRatio: 2 });

  map.addLayer({
    id: 'places-dot', type: 'circle', source: 'places',
    paint: { 'circle-radius': 5, 'circle-color': '#0b0b0b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'places-label', type: 'symbol', source: 'places',
    layout: {
      'text-field': ['step', ['zoom'], ['get', 'short'], 18, ['format', ['get', 'short'], {}, '\n', {}, ['get', 'name'], { 'font-scale': 0.8 }]],
      'text-font': ['Noto Sans Medium'],
      'text-size': 15,
      'text-anchor': 'top',
      'text-offset': [0, 0.6],
      'symbol-sort-key': ['get', 'priority'],
    },
    paint: { 'text-color': '#0b0b0b', 'text-halo-color': '#ffffff', 'text-halo-width': 2.5 },
  });
  map.addLayer({
    id: 'user-accuracy', type: 'circle', source: 'user',
    paint: {
      // Radio en metros convertido a píxeles según el zoom (en la latitud del campus).
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 14, ['/', ['get', 'acc'], 9.03], 22, ['/', ['get', 'acc'], 0.0353]],
      'circle-color': '#1a73e8',
      'circle-opacity': 0.12,
      'circle-stroke-color': '#1a73e8',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.4,
    },
  });
  map.addLayer({
    id: 'user-cone', type: 'symbol', source: 'user',
    filter: ['has', 'heading'],
    layout: {
      'icon-image': 'heading-cone',
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'user-dot', type: 'circle', source: 'user',
    paint: { 'circle-radius': 9, 'circle-color': '#1a73e8', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
  map.addLayer({
    id: 'destination', type: 'circle', source: 'destination',
    paint: { 'circle-radius': 13, 'circle-color': '#c8102e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 4 },
  });
  map.addLayer({
    id: 'destination-label', type: 'symbol', source: 'destination',
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 17,
      'text-anchor': 'bottom',
      'text-offset': [0, -1.3],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#c8102e', 'text-halo-color': '#ffffff', 'text-halo-width': 3 },
  });
}

export function CampusMap() {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const pending = useRef<((map: MapLibreMap) => void)[]>([]);

  const campus = useApp((s) => s.campus);
  const lang = useApp((s) => s.lang);
  const destination = useApp((s) => s.destination);
  const location = useApp((s) => s.location);
  const following = useApp((s) => s.following);
  const orientation = useApp((s) => s.orientation);
  const heading = useApp((s) => s.heading);
  const data = campus.status === 'ready' ? campus.data : null;

  useEffect(() => {
    const [w, s, e, n] = CAMPUS_BBOX;
    const map = new maplibregl.Map({
      container: container.current!,
      style: campusStyle(window.location.origin),
      center: CAMPUS_CENTER,
      zoom: 16.3,
      minZoom: 14,
      maxZoom: 20,
      maxBounds: [[w - 0.01, s - 0.01], [e + 0.01, n + 0.01]],
      // La rotación la controla el botón de orientación, no los gestos (evita giros accidentales).
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;

    map.on('load', () => {
      addLayers(map);
      loaded.current = true;
      for (const fn of pending.current.splice(0)) fn(map);
    });

    const openPlace = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties.id as string | undefined;
      const s = useApp.getState();
      const place = s.campus.status === 'ready' ? s.campus.data.places.find((p) => p.id === id) : undefined;
      if (place) s.openDetail({ type: 'place', place });
    };
    map.on('click', 'places-dot', openPlace);
    map.on('click', 'places-label', openPlace);
    for (const layer of ['places-dot', 'places-label']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    // Si el usuario mueve el mapa, deja de seguir su ubicación hasta que toque "Mi ubicación".
    map.on('dragstart', () => useApp.getState().setFollowing(false));

    return () => {
      loaded.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /** Ejecuta `fn` cuando el mapa y sus capas están listos. */
  function whenReady(fn: (map: MapLibreMap) => void) {
    const map = mapRef.current;
    if (!map) return;
    if (loaded.current) fn(map);
    else pending.current.push(fn);
  }

  useEffect(() => {
    if (data) whenReady((map) => (map.getSource('places') as GeoJSONSource).setData(placesGeoJSON(data, lang)));
  }, [data, lang]);

  useEffect(() => {
    whenReady((map) => {
      const loc = destination && (resultLocation(destination) ?? (destination.type === 'building' ? destination.place.location : undefined));
      (map.getSource('destination') as GeoJSONSource).setData(
        loc && destination ? point(loc, { title: resultTitle(destination, lang) }) : EMPTY,
      );
      // El pin del destino reemplaza al marcador normal de ese lugar.
      const destId = destination?.type === 'place' || destination?.type === 'building' ? destination.place.id : '';
      for (const layer of ['places-dot', 'places-label']) map.setFilter(layer, ['!=', ['get', 'id'], destId]);
      if (loc) map.easeTo({ center: loc, zoom: Math.max(map.getZoom(), 17.5), padding: { bottom: 260, top: 80, left: 0, right: 0 } });
    });
  }, [destination, lang]);

  useEffect(() => {
    whenReady((map) => {
      const fix = location.fix;
      const props: Record<string, number> = fix ? { acc: fix.accuracyM } : {};
      if (fix && heading !== null) props.heading = heading;
      (map.getSource('user') as GeoJSONSource).setData(fix ? point(fix.pos, props) : EMPTY);
      if (fix && following) map.easeTo({ center: fix.pos, zoom: Math.max(map.getZoom(), 17.5) });
    });
  }, [location, following, heading]);

  useEffect(() => {
    whenReady((map) => map.easeTo({ bearing: orientation === 'heading' && heading !== null ? heading : 0, duration: 250 }));
  }, [orientation, heading]);

  return <div ref={container} className={styles.map} role="region" aria-label={t('map.label')} />;
}
