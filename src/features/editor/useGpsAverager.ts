import { useCallback, useEffect, useRef, useState } from 'react';
import type { LngLat } from '../../core/data/types';

/** Lecturas con peor precisión que esta se descartan. */
const MAX_ACCURACY_M = 30;

export interface GpsState {
  running: boolean;
  samples: number;
  rejected: number;
  estimate?: { pos: LngLat; accuracyM: number };
  error?: string;
}

/**
 * Promedia lecturas de GPS ponderadas por 1/precisión² mientras el usuario está quieto,
 * para marcar puntos del campus con más exactitud que una sola lectura.
 */
export function useGpsAverager() {
  const [state, setState] = useState<GpsState>({ running: false, samples: 0, rejected: 0 });
  const watchId = useRef<number | null>(null);
  const sums = useRef({ w: 0, lng: 0, lat: 0, n: 0, rejected: 0 });

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setState((s) => ({ ...s, running: false }));
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ running: false, samples: 0, rejected: 0, error: 'Este navegador no tiene GPS.' });
      return;
    }
    stop();
    sums.current = { w: 0, lng: 0, lat: 0, n: 0, rejected: 0 };
    setState({ running: true, samples: 0, rejected: 0 });
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const s = sums.current;
        if (coords.accuracy > MAX_ACCURACY_M) {
          s.rejected++;
          setState((prev) => ({ ...prev, rejected: s.rejected }));
          return;
        }
        const w = 1 / coords.accuracy ** 2;
        s.w += w;
        s.lng += coords.longitude * w;
        s.lat += coords.latitude * w;
        s.n++;
        setState({
          running: true,
          samples: s.n,
          rejected: s.rejected,
          estimate: { pos: [s.lng / s.w, s.lat / s.w], accuracyM: 1 / Math.sqrt(s.w) },
        });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en el navegador (requiere HTTPS).'
            : 'No se pudo obtener la ubicación.';
        setState((prev) => ({ ...prev, running: false, error: message }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState({ running: false, samples: 0, rejected: 0 });
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { state, start, stop, reset };
}
