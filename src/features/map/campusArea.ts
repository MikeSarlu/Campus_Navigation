import type { LngLat } from '../../core/data/types';
import campusBoundary from './campusBoundary.json';

/** Margen alrededor del contorno del campus (~400 m), dentro del cual el mapa tiene teselas. */
const MARGIN_DEG = 0.004;

/**
 * Límites de desplazamiento: un margen corto a los lados del campus. Hacia arriba y abajo se deja
 * lo necesario para que en un celular vertical quepa el campus completo a lo ancho (MapLibre no
 * deja ver nada fuera de estos límites y, si no cupiera, forzaría un acercamiento).
 */
export function campusMaxBounds(): [[number, number], [number, number]] {
  const [w, s, e, n] = campusBoundary.properties.bbox;
  const widthInLatDeg = ((e - w) * 105_220) / 110_540;
  // 1.7 × el ancho cubre pantallas de hasta ~20:9 aun descontando el espacio de la barra y los controles.
  const halfLat = Math.max((n - s) / 2 + MARGIN_DEG, widthInLatDeg * 1.7);
  const midLat = (n + s) / 2;
  return [[w - MARGIN_DEG, midLat - halfLat], [e + MARGIN_DEG, midLat + halfLat]];
}

/**
 * true si la posición está en el campus o a unos cientos de metros. Fuera de esa zona el mapa no
 * puede mostrarla (no hay teselas) ni tiene sentido calcular una ruta desde ahí.
 */
export function isNearCampus([lng, lat]: LngLat): boolean {
  const [w, s, e, n] = campusBoundary.properties.bbox;
  return lng >= w - MARGIN_DEG && lng <= e + MARGIN_DEG && lat >= s - MARGIN_DEG && lat <= n + MARGIN_DEG;
}
