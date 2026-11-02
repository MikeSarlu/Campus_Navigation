// Rumbo de la brújula (grados desde el norte, en sentido horario).

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type IOSPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** En iOS hay que pedir permiso desde un toque del usuario; en otros navegadores no hace falta. */
export async function requestHeadingPermission(): Promise<boolean> {
  const ctor = (globalThis as { DeviceOrientationEvent?: IOSPermission }).DeviceOrientationEvent;
  if (!ctor) return false;
  if (typeof ctor.requestPermission !== 'function') return true;
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Llama a `onHeading` con cada lectura. Si en `timeoutMs` no llega ninguna (no hay brújula),
 * llama a `onUnavailable`. Devuelve una función para detenerse.
 */
export function watchHeading(onHeading: (deg: number) => void, onUnavailable: () => void, timeoutMs = 2_500): () => void {
  let received = false;
  const handle = (e: Event) => {
    const ev = e as IOSOrientationEvent;
    let deg: number | undefined;
    if (typeof ev.webkitCompassHeading === 'number') deg = ev.webkitCompassHeading; // iOS
    else if (ev.absolute && typeof ev.alpha === 'number') deg = (360 - ev.alpha) % 360; // Android
    if (deg === undefined) return;
    received = true;
    onHeading(deg);
  };
  // Android Chrome entrega el rumbo absoluto en un evento aparte.
  const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(type, handle);
  const timer = setTimeout(() => !received && onUnavailable(), timeoutMs);
  return () => {
    clearTimeout(timer);
    window.removeEventListener(type, handle);
  };
}
