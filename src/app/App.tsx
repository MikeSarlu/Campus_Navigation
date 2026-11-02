import { useEffect, type CSSProperties } from 'react';
import { loadEditorDraft } from '../core/data/editorDraft';
import { loadCampus } from '../core/data/loadCampus';
import { validateCampus } from '../core/data/validate';
import { CampusMap } from '../features/map/CampusMap';
import { MapControls } from '../features/map/MapControls';
import { NavigationView } from '../features/navigation/NavigationView';
import { CategoryChips } from '../features/search/CategoryChips';
import { DetailSheet } from '../features/search/DetailSheet';
import { SearchBar } from '../features/search/SearchBar';
import { SearchPanel } from '../features/search/SearchPanel';
import styles from './app.module.css';
import { useApp, useT, type View } from './store';
import { Toast } from './Toast';

const previewDraft = new URLSearchParams(window.location.search).get('datos') === 'editor';

export function App() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const view = useApp((s) => s.view);
  const campus = useApp((s) => s.campus);
  const previewing = useApp((s) => s.previewingDraft);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const { setCampus } = useApp.getState();
    const load = async () => {
      const draft = previewDraft ? await loadEditorDraft().catch(() => undefined) : undefined;
      const data = draft ?? (await loadCampus());
      const errors = validateCampus(data).filter((i) => i.level === 'error');
      if (errors.length) console.warn('campus.json tiene errores:', errors);
      setCampus({ status: 'ready', data }, !!draft);
    };
    load().catch((err: Error) => setCampus({ status: 'error', message: err.message }));
  }, []);

  // El botón Atrás del teléfono cierra el panel abierto.
  useEffect(() => {
    // Al recargar, el navegador conserva el estado de la entrada actual, pero la app arranca en el inicio.
    if (history.state?.view) history.replaceState(null, '');
    const onPop = (e: PopStateEvent) => useApp.getState().syncView((e.state?.view as View | undefined) ?? 'home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const data = campus.status === 'ready' ? campus.data : null;

  return (
    // --top-extra: espacio que ocupa el aviso de vista previa sobre la barra de búsqueda.
    <main className={styles.screen} style={{ '--top-extra': previewing ? '36px' : '0px' } as CSSProperties}>
      <CampusMap />
      {view === 'search' && data && <SearchPanel data={data} />}
      {view === 'navigate' ? (
        // Durante la navegación la búsqueda se oculta: solo la instrucción, el resumen y Detener.
        <NavigationView controls={<MapControls />} />
      ) : (
        <header className={styles.top}>
          {previewing && <p className={styles.preview}>{t('preview.banner')}</p>}
          <SearchBar />
          {view === 'home' && <CategoryChips />}
        </header>
      )}
      {(view === 'home' || view === 'detail') && (
        <div className={styles.bottom}>
          <div className={styles.controls}>
            <MapControls />
          </div>
          {view === 'detail' && <DetailSheet />}
          {campus.status !== 'ready' && (
            <p className={styles.status} role={campus.status === 'error' ? 'alert' : undefined}>
              {t(campus.status === 'error' ? 'data.error' : 'data.loading')}
            </p>
          )}
        </div>
      )}
      <Toast />
    </main>
  );
}
