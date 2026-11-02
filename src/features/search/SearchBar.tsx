import { useState } from 'react';
import { ClearIcon, SearchIcon } from '../../app/icons';
import { useT } from '../../app/store';
import styles from './search.module.css';

export function SearchBar() {
  const t = useT();
  const [query, setQuery] = useState('');

  return (
    <form className={styles.bar} role="search" onSubmit={(e) => e.preventDefault()}>
      <SearchIcon />
      <input
        className={styles.input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="characters"
        aria-label={t('search.placeholder')}
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label={t('search.clear')}>
          <ClearIcon />
        </button>
      )}
    </form>
  );
}
