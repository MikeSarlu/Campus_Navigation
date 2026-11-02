import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { readDownloadedAt, setupPwa } from './app/pwa';
import { useApp } from './app/store';
import './styles/global.css';

// El editor es una herramienta interna: se carga aparte para no pesar en la app.
const EditorApp = lazy(() => import('./features/editor/EditorApp').then((m) => ({ default: m.EditorApp })));
const isEditor = window.location.pathname.startsWith('/editor');

if (!isEditor) {
  const downloadedAt = readDownloadedAt();
  if (downloadedAt) useApp.getState().setDownloadedAt(downloadedAt);
  setupPwa();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isEditor ? (
      <Suspense fallback={null}>
        <EditorApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

// Solo en desarrollo: acceso a los stores desde la consola para simular GPS y depurar.
if (import.meta.env.DEV) {
  void Promise.all([import('./app/store'), import('./features/navigation/navStore')]).then(([app, nav]) => {
    Object.assign(window, { __campus: { useApp: app.useApp, useNav: nav.useNav } });
  });
  // Auditoría de accesibilidad desde la consola: await __axe()
  Object.assign(window, {
    __axe: async () => {
      const { default: axe } = await import('axe-core');
      const res = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5) }));
    },
  });
}
