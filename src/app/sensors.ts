// Conecta los sensores del teléfono con el estado de la app. Un solo observador de cada uno.
import { requestHeadingPermission, watchHeading } from '../core/sensors/heading';
import { watchLocation } from '../core/sensors/location';
import { useApp } from './store';

let stopLocation: (() => void) | null = null;
let stopHeading: (() => void) | null = null;

/** Botón "Mi ubicación": empieza a seguir la ubicación (si hace falta) y centra el mapa. */
export function locateMe(): void {
  const s = useApp.getState();
  s.setFollowing(true);
  if (stopLocation && s.location.status !== 'denied' && s.location.status !== 'unavailable') return;
  stopLocation?.();
  s.setLocation({ status: 'locating' });
  stopLocation = watchLocation(
    (fix) => useApp.getState().setLocation({ status: 'on', fix }),
    (status) => {
      const st = useApp.getState();
      // Un error pasajero no borra una ubicación que ya teníamos.
      if (status === 'unavailable' && st.location.fix) return;
      stopLocation?.();
      stopLocation = null;
      st.setLocation({ status });
      st.setFollowing(false);
      st.showToast(status === 'denied' ? 'location.denied' : 'location.unavailable');
    },
  );
}

const MIN_DELTA_DEG = 3;
const MIN_INTERVAL_MS = 100;

/** Botón de orientación: alterna entre norte arriba y el rumbo de la brújula. */
export async function toggleOrientation(): Promise<void> {
  const s = useApp.getState();
  if (s.orientation === 'heading') {
    stopHeading?.();
    stopHeading = null;
    s.setOrientation('north');
    return;
  }
  if (!(await requestHeadingPermission())) {
    s.showToast('heading.denied');
    return;
  }
  s.setOrientation('heading');
  let last = { deg: -999, at: 0 };
  stopHeading = watchHeading(
    (deg) => {
      // Limitar actualizaciones: la brújula emite decenas de lecturas por segundo.
      const now = performance.now();
      const delta = Math.abs(((deg - last.deg + 540) % 360) - 180);
      if (delta < MIN_DELTA_DEG || now - last.at < MIN_INTERVAL_MS) return;
      last = { deg, at: now };
      useApp.getState().setHeading(deg);
    },
    () => {
      stopHeading?.();
      stopHeading = null;
      useApp.getState().setOrientation('north');
      useApp.getState().showToast('heading.unavailable');
    },
  );
}
