import { useEffect, useMemo, useRef, useState } from 'react';
import { validateCampus } from '../../core/data/validate';
import styles from './editor.module.css';
import { useEditor } from './editorStore';
import { IndoorEditor } from './indoor/IndoorEditor';
import { IndoorPanel } from './indoor/IndoorPanel';
import { OutdoorEditor, type Basemap } from './outdoor/OutdoorEditor';
import { OutdoorPanel } from './outdoor/OutdoorPanel';
import { exportCampus, importCampus, initEditor, reloadPublished } from './persistence';
import { SelectionPanel } from './SelectionPanel';
import { useGpsAverager } from './useGpsAverager';

export function EditorApp() {
  const data = useEditor((s) => s.data);
  const mode = useEditor((s) => s.mode);
  const setMode = useEditor((s) => s.setMode);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo } = useEditor.getState();
  const [source, setSource] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>('osm');
  const [showIssues, setShowIssues] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const gps = useGpsAverager();

  useEffect(() => {
    document.title = 'Editor · UDLAP Campus';
    initEditor()
      .then((from) => setSource(from === 'autosave' ? 'Trabajo guardado en este navegador' : 'campus.json publicado'))
      .catch((e: Error) => setSource(`Error al cargar: ${e.message}`));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const s = useEditor.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (e.key === 'Escape') {
        s.set({ chainFrom: null, draft: [], pendingRoom: null });
        s.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const issues = useMemo(() => (data ? validateCampus(data) : []), [data]);
  const errors = issues.filter((i) => i.level === 'error').length;

  if (!data) return <p className={styles.loading}>{source ?? 'Cargando…'}</p>;

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importCampus(file);
      setSource(`Importado: ${file.name}`);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className={styles.editor}>
      <header className={styles.topbar}>
        <strong className={styles.brand}>Editor</strong>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'outdoor'} onClick={() => setMode('outdoor')}>Exterior</button>
          <button type="button" role="tab" aria-selected={mode === 'indoor'} onClick={() => setMode('indoor')}>Interior</button>
        </div>
        <button type="button" onClick={undo} disabled={!canUndo} title="Ctrl+Z">Deshacer</button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Ctrl+Y">Rehacer</button>
        <button type="button" onClick={() => setShowIssues((v) => !v)} aria-pressed={showIssues}
          className={errors ? styles.issuesBad : styles.issuesOk}>
          {errors ? `${errors} errores` : 'Sin errores'}
        </button>
        <span className={styles.spacer} />
        <a className={styles.link} href="/?datos=editor" target="_blank" rel="noopener">Ver en la app</a>
        <button type="button" onClick={() => fileInput.current?.click()}>Importar</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" className={styles.primary} onClick={() => exportCampus(data)}>Exportar campus.json</button>
      </header>

      <main className={styles.workspace}>
        {mode === 'outdoor' ? <OutdoorEditor basemap={basemap} gpsPos={gps.state.estimate?.pos} /> : <IndoorEditor />}
        <aside className={styles.panel}>
          {showIssues && <IssuesSection issues={issues} />}
          <SelectionPanel />
          {mode === 'outdoor' ? <OutdoorPanel basemap={basemap} onBasemap={setBasemap} gps={gps} /> : <IndoorPanel />}
          <section className={styles.section}>
            <p className={styles.hint}>
              Origen: {source}. Los cambios se guardan solos en este navegador; exporta para publicarlos.
            </p>
            <button type="button" className={styles.buttonQuiet} onClick={() => {
              if (confirm('¿Cargar el campus.json publicado? Tu trabajo local se reemplaza (puedes deshacer).')) {
                void reloadPublished().then(() => setSource('campus.json publicado'));
              }
            }}>
              Cargar campus.json publicado
            </button>
          </section>
        </aside>
      </main>
    </div>
  );
}

function IssuesSection({ issues }: { issues: ReturnType<typeof validateCampus> }) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  return (
    <section className={styles.section}>
      <h2>Validación</h2>
      {!issues.length && <p>Todo en orden.</p>}
      {errors.length > 0 && (
        <ul className={styles.issues}>
          {errors.map((i, k) => <li key={k} className={styles.error}>{i.message}</li>)}
        </ul>
      )}
      {warnings.length > 0 && (
        <details>
          <summary>{warnings.length} avisos</summary>
          <ul className={styles.issues}>
            {warnings.map((i, k) => <li key={k}>{i.message}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
