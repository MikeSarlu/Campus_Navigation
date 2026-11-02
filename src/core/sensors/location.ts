import type { LngLat } from '../data/types';

export type LocationStatus = 'off' | 'locating' | 'on' | 'denied' | 'unavailable';

export interface LocationFix {
  pos: LngLat;
  accuracyM: number;
}

/** Sigue la ubicación del usuario. Devuelve una función para detenerse. */
export function watchLocation(onFix: (fix: LocationFix) => void, onError: (status: 'denied' | 'unavailable') => void): () => void {
  if (!('geolocation' in navigator)) {
    onError('unavailable');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    ({ coords }) => onFix({ pos: [coords.longitude, coords.latitude], accuracyM: coords.accuracy }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
