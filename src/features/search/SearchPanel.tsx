import { useMemo } from 'react';
import { useApp, useT } from '../../app/store';
import type { CampusData, Place } from '../../core/data/types';
import { placesInCategory, search, type SearchResult } from '../../core/search';
import { resultSubtitle, resultTitle } from './resultText';
import styles from './search.module.css';

function ResultList({ results }: { results: SearchResult[] }) {
  const lang = useApp((s) => s.lang);
  const openDetail = useApp((s) => s.openDetail);
  return (
    <ul className={styles.results}>
      {results.map((r, i) => (
        <li key={`${r.type}-${resultTitle(r, 'es')}-${i}`}>
          <button type="button" className={styles.result} onClick={() => openDetail(r)}>
            <span className={styles.resultTitle}>{resultTitle(r, lang)}</span>
            <span className={styles.resultSubtitle}>{resultSubtitle(r, lang)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Explicación general de los códigos y lista de siglas de edificios. */
export function CodesExplainer({ data, open }: { data: CampusData; open?: boolean }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const buildings = useMemo(
    () => data.places.filter((p) => p.kind === 'building' && p.siglas).sort((a, b) => a.siglas!.localeCompare(b.siglas!, 'es', { numeric: true })),
    [data],
  );
  return (
    <details className={styles.codes} open={open}>
      <summary>{t('codes.title')}</summary>
      <p>{t('codes.body')}</p>
      <h3>{t('codes.list')}</h3>
      <dl className={styles.siglasList}>
        {buildings.map((p) => (
          <div key={p.id}>
            <dt>{p.siglas}</dt>
            <dd>{p.name[lang]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Explanation({ siglas, places, floor }: { siglas: string; places: Place[]; floor?: number }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  return (
    <div className={styles.explanation} role="note">
      <p className={styles.explanationMain}>{t('search.explain', { siglas, names: places.map((p) => p.name[lang]).join(' / ') })}</p>
      {floor !== undefined && <p>{t('search.explain.floor', { floor })}</p>}
    </div>
  );
}

export function SearchPanel({ data }: { data: CampusData }) {
  const t = useT();
  const query = useApp((s) => s.query);
  const category = useApp((s) => s.category);
  const userPos = useApp((s) => s.location.fix?.pos);

  const outcome = useMemo(() => search(query, data), [query, data]);
  const categoryResults = useMemo(
    () => (category ? placesInCategory(category, data, userPos).map((place): SearchResult => ({ type: 'place', place })) : []),
    [category, data, userPos],
  );

  let body;
  if (category) {
    body = (
      <>
        <h2 className={styles.heading}>{t(`category.${category}`)}</h2>
        <ResultList results={categoryResults} />
      </>
    );
  } else if (!query.trim()) {
    body = (
      <div className={styles.help}>
        <p className={styles.helpTitle}>{t('search.help.title')}</p>
        <p>{t('search.help.examples')}</p>
        <CodesExplainer data={data} />
      </div>
    );
  } else {
    const { results, explanation } = outcome;
    body = (
      <>
        {explanation && <Explanation {...explanation} />}
        {results.length ? (
          <>
            <p className={styles.count} aria-live="polite">{results.length === 1 ? t('search.count.one') : t('search.count', { n: results.length })}</p>
            <ResultList results={results} />
          </>
        ) : (
          <div className={styles.help} aria-live="polite">
            <p className={styles.helpTitle}>{t('search.none.title', { query: query.trim() })}</p>
            <p>{t('search.none.tips')}</p>
            <CodesExplainer data={data} open />
          </div>
        )}
      </>
    );
  }

  return <div className={styles.panel}>{body}</div>;
}
