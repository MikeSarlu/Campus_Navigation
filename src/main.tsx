import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';

// El editor es una herramienta interna: se carga aparte para no pesar en la app.
const EditorApp = lazy(() => import('./features/editor/EditorApp').then((m) => ({ default: m.EditorApp })));
const isEditor = window.location.pathname.startsWith('/editor');

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
