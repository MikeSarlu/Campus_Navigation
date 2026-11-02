import { BackIcon, ClearIcon, SearchIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import styles from './search.module.css';

export function SearchBar() {
  const t = useT();
  const view = useApp((s) => s.view);
  const query = useApp((s) => s.query);
  const { setQuery, openSearch, back } = useApp.getState();
  const searching = view === 'search';

  return (
    <form className={styles.bar} role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement)?.blur(); }}>
      {searching ? (
        <button type="button" className={styles.iconButton} onClick={back} aria-label={t('search.back')}>
          <BackIcon />
        </button>
      ) : (
        <span className={styles.iconSlot}><SearchIcon /></span>
      )}
      <input
        className={styles.input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={t('search.placeholder')}
        placeholder={t('search.placeholder')}
        value={query}
        onFocus={() => openSearch()}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button type="button" className={styles.iconButton} onClick={() => setQuery('')} aria-label={t('search.clear')}>
          <ClearIcon />
        </button>
      )}
    </form>
  );
}
