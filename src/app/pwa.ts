// Registro del service worker (uso sin conexión) y estado de la conexión.
import { registerSW } from 'virtual:pwa-register';
import { useApp } from './store';

const DOWNLOADED_KEY = 'campus.downloadedAt';

export function readDownloadedAt(): string | null {
  try {
    return localStorage.getItem(DOWNLOADED_KEY);
  } catch {
    return null;
  }
}

function markDownloaded() {
  const now = new Date().toISOString();
  try {
    localStorage.setItem(DOWNLOADED_KEY, now);
  } catch {
    /* sin almacenamiento: solo no se mostrará la fecha */
  }
  useApp.getState().setDownloadedAt(now);
}

export function setupPwa(): void {
  const setOnline = () => useApp.getState().setOnline(navigator.onLine);
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  setOnline();

  // En desarrollo no hay service worker (Vite sirve los archivos al vuelo).
  if (import.meta.env.DEV) return;

  let updatePending = false;
  const updateSW = registerSW({
    immediate: true,
    // Primera descarga completa: ya funciona sin conexión.
    onOfflineReady: markDownloaded,
    // Hay una versión nueva descargada: se aplica en cuanto el usuario esté en el mapa inicial.
    onNeedRefresh: () => {
      updatePending = true;
      applyIfIdle();
    },
  });

  function applyIfIdle() {
    if (!updatePending || useApp.getState().view !== 'home') return;
    updatePending = false;
    markDownloaded();
    void updateSW(true);
  }
  useApp.subscribe((s, prev) => {
    if (s.view !== prev.view) applyIfIdle();
  });
}
