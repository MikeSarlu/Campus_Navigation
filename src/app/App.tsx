import { useEffect } from 'react';
import { loadCampus } from '../core/data/loadCampus';
import { validateCampus } from '../core/data/validate';
import { MapControls } from '../features/map/MapControls';
import { MapPlaceholder } from '../features/map/MapPlaceholder';
import { CategoryChips } from '../features/search/CategoryChips';
import { SearchBar } from '../features/search/SearchBar';
import styles from './app.module.css';
import { useApp, useT } from './store';

function DataStatus() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const campus = useApp((s) => s.campus);

  if (campus.status === 'loading') return <p className={styles.status}>{t('data.loading')}</p>;
  if (campus.status === 'error') return <p className={styles.status} role="alert">{t('data.error')}</p>;
  const date = new Date(campus.data.generatedAt).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
  return <p className={styles.status}>{t('data.summary', { places: campus.data.places.length, date })}</p>;
}

export function App() {
  const setCampus = useApp((s) => s.setCampus);
  const lang = useApp((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    loadCampus()
      .then((data) => {
        const errors = validateCampus(data).filter((i) => i.level === 'error');
        if (errors.length) console.warn('campus.json tiene errores:', errors);
        setCampus({ status: 'ready', data });
      })
      .catch((err: Error) => setCampus({ status: 'error', message: err.message }));
  }, [setCampus]);

  return (
    <main className={styles.screen}>
      <MapPlaceholder />
      <header className={styles.top}>
        <SearchBar />
        <CategoryChips />
      </header>
      <aside className={styles.controls}>
        <MapControls />
      </aside>
      <footer className={styles.bottom}>
        <DataStatus />
      </footer>
    </main>
  );
}
