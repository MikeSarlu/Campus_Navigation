import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useApp, useT } from '../../app/store';
import type { CampusData, LngLat, PlaceKind } from '../../core/data/types';
import { pointAlong, sliceLineFrom } from '../../core/routing/planar';
import { resultLocation } from '../../core/search';
import { useNav } from '../navigation/navStore';
import { resultTitle } from '../search/resultText';
import campusBoundary from './campusBoundary.json';
import { campusStyle } from './campusStyle';
import { maplibregl, maplibreReady } from './maplibre';
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

/**
 * Límites de desplazamiento: un margen corto (~400 m) a los lados del campus. Hacia arriba y abajo
 * se deja lo necesario para que en un celular vertical quepa el campus completo a lo ancho
 * (MapLibre no deja ver nada fuera de estos límites y, si no cupiera, forzaría un acercamiento).
 */
function campusMaxBounds(): [[number, number], [number, number]] {
  const [w, s, e, n] = campusBoundary.properties.bbox;
  const MARGIN_DEG = 0.004;
  const widthInLatDeg = ((e - w) * 105_220) / 110_540;
  // 1.7 × el ancho cubre pantallas de hasta ~20:9 aun descontando el espacio de la barra y los controles.
  const halfLat = Math.max((n - s) / 2 + MARGIN_DEG, widthInLatDeg * 1.7);
  const midLat = (n + s) / 2;
  return [[w - MARGIN_DEG, midLat - halfLat], [e + MARGIN_DEG, midLat + halfLat]];
}

/**
 * Polígono del mundo con el campus como hueco: al pintarlo semitransparente, los alrededores se
 * atenúan y el campus resalta a simple vista.
 */
function outsideCampus(): FeatureCollection {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const hole = [...campusBoundary.geometry.coordinates[0]].reverse();
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, hole] }, properties: {} }] };
}

function addLayers(map: MapLibreMap) {
  map.addSource('outside-campus', { type: 'geojson', data: outsideCampus() });
  map.addSource('campus-boundary', { type: 'geojson', data: campusBoundary as GeoJSON.Feature });
  map.addLayer({ id: 'outside-campus', type: 'fill', source: 'outside-campus', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.72 } });
  map.addLayer({
    id: 'campus-boundary', type: 'line', source: 'campus-boundary',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#3d3d3a', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 4] },
  });
  for (const id of ['route', 'route-tail', 'places', 'destination', 'user']) map.addSource(id, { type: 'geojson', data: EMPTY });
  map.addImage('heading-cone', coneImage(), { pixelRatio: 2 });

  // Ruta azul con borde blanco, como en otras apps de mapas (docs/DISENO.md §7).
  map.addLayer({
    id: 'route-casing', type: 'line', source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 9, 19, 16] },
  });
  // Último tramo, en línea recta, del final del camino hasta el pin (cuando no coinciden).
  map.addLayer({
    id: 'route-tail', type: 'line', source: 'route-tail',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#0040c1', 'line-width': 4, 'line-dasharray': [1, 1.5] },
  });
  map.addLayer({
    id: 'route', type: 'line', source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#0040c1', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 5, 19, 10] },
  });

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
    paint: { 'circle-radius': 13, 'circle-color': '#b00e28', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 4 },
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
    paint: { 'text-color': '#b00e28', 'text-halo-color': '#ffffff', 'text-halo-width': 3 },
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
      const [w, s, e, n] = campusBoundary.properties.bbox;
      const map = new maplibregl.Map({
        container: container.current!,
        style: campusStyle(),
        // Abre con el campus completo a la vista, debajo de la barra de búsqueda.
        bounds: [[w, s], [e, n]],
        fitBoundsOptions: { padding: { top: 130, bottom: 40, left: 12, right: 12 } },
        maxZoom: 20,
        // No se puede alejar ni desplazar mucho más allá del campus.
        maxBounds: campusMaxBounds(),
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
        if (useNav.getState().pickingOnMap || useApp.getState().view === 'navigate') return;
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
      // Elegir el punto de partida tocando el mapa (cuando no hay GPS).
      map.on('click', (e) => {
        const nav = useNav.getState();
        if (nav.phase === 'choosingStart' && nav.pickingOnMap) nav.startFrom([e.lngLat.lng, e.lngLat.lat], 'manual');
      });
      // Si el usuario mueve el mapa, deja de seguir su ubicación hasta que toque "Mi ubicación".
      map.on('dragstart', () => useApp.getState().setFollowing(false));

      return () => {
        loaded.current = false;
        map.remove();
        mapRef.current = null;
      };
    }
  }, []);

  /** Ejecuta `fn` cuando el mapa y sus capas están listos. */
  function whenReady(fn: (map: MapLibreMap) => void) {
    const map = mapRef.current;
    // El mapa se crea de forma asíncrona: lo que llegue antes se aplica al cargar.
    if (map && loaded.current) fn(map);
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
      // Desplazado hacia arriba para que el panel inferior no tape el pin. Se usa `offset` y no
      // `padding` porque el padding queda guardado en el mapa y descuadra los encuadres siguientes.
      if (loc) map.easeTo({ center: loc, zoom: Math.max(map.getZoom(), 17.5), offset: [0, -90] });
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

  // Ruta: completa al empezar; con GPS solo lo que falta por caminar.
  const route = useNav((s) => s.route);
  const navMode = useNav((s) => s.mode);
  const alongM = useNav((s) => s.alongM);
  const stepIndex = useNav((s) => s.stepIndex);
  const steps = useNav((s) => s.steps);

  useEffect(() => {
    whenReady((map) => {
      const coords = route?.outdoorCoords ?? [];
      const line = navMode === 'gps' ? sliceLineFrom(coords, alongM) : coords;
      const lineFC = (coords: LngLat[]): FeatureCollection =>
        coords.length >= 2 ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }] } : EMPTY;
      (map.getSource('route') as GeoJSONSource).setData(lineFC(line));
      const end = coords.at(-1);
      const pin = destination && (resultLocation(destination) ?? (destination.type === 'building' ? destination.place.location : undefined));
      (map.getSource('route-tail') as GeoJSONSource).setData(end && pin && route?.indoorFrom === route?.nodes.length ? lineFC([end, pin]) : EMPTY);
    });
  }, [route, navMode, alongM, destination]);

  // Al calcular una ruta nueva, mostrarla completa.
  useEffect(() => {
    if (!route || route.outdoorCoords.length < 2) return;
    whenReady((map) => {
      const bounds = new maplibregl.LngLatBounds(route.outdoorCoords[0], route.outdoorCoords[0]);
      for (const c of route.outdoorCoords) bounds.extend(c);
      map.fitBounds(bounds, { padding: { top: 200, bottom: 240, left: 40, right: 90 }, maxZoom: 18.5, bearing: map.getBearing() });
    });
  }, [route]);

  // Sin GPS, el mapa acompaña el paso que se está leyendo.
  useEffect(() => {
    if (!route || navMode !== 'manual' || !steps[stepIndex] || stepIndex === 0) return;
    whenReady((map) => map.easeTo({ center: pointAlong(route.outdoorCoords, steps[stepIndex].alongM), zoom: Math.max(map.getZoom(), 18) }));
  }, [route, navMode, stepIndex, steps]);

  return <div ref={container} className={styles.map} role="region" aria-label={t('map.label')} />;
}
