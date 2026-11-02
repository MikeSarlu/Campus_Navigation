import { useMemo, useState } from 'react';
import { BackIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import { useFocusOnMount } from '../../app/useFocusOnMount';
import { normalizeQuery, parseRoomCode } from '../../core/data/codes';
import styles from './report.module.css';
import { useReports, type Report } from './reports';

/** Formulario para reportar un salón que no aparece en la búsqueda. */
export function ReportView() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const campus = useApp((s) => s.campus);
  const online = useApp((s) => s.online);
  const fix = useApp((s) => (s.location.status === 'on' ? s.location.fix : undefined));
  const initialCode = useApp((s) => s.reportCode);
  const back = useApp((s) => s.back);
  const reports = useReports((s) => s.reports);
  const submit = useReports((s) => s.submit);
  const titleRef = useFocusOnMount<HTMLHeadingElement>();

  const buildings = useMemo(
    () => (campus.status === 'ready' ? campus.data.places.filter((p) => p.kind === 'building' && p.siglas) : [])
      .sort((a, b) => a.siglas!.localeCompare(b.siglas!, 'es', { numeric: true })),
    [campus],
  );

  // Se proponen edificio y piso a partir del código buscado (CN-230 → CN, piso 2).
  const suggest = (code: string) => {
    const parsed = parseRoomCode(code);
    return {
      placeId: buildings.find((b) => b.siglas!.toUpperCase() === parsed?.siglas)?.id ?? '',
      floor: parsed ? String(parsed.floor) : '',
    };
  };
  const [code, setCode] = useState(normalizeQuery(initialCode));
  const [placeId, setPlaceId] = useState(() => suggest(initialCode).placeId);
  const [floor, setFloor] = useState(() => suggest(initialCode).floor);
  const [details, setDetails] = useState('');
  const [attach, setAttach] = useState(false);
  const [done, setDone] = useState<Report | null>(null);

  const onCode = (value: string) => {
    setCode(value.toUpperCase());
    const s = suggest(value);
    if (s.placeId) setPlaceId(s.placeId);
    if (s.floor) setFloor(s.floor);
  };

  const send = () => {
    const report = submit({
      code: parseRoomCode(code)?.code ?? code.trim(),
      placeId: placeId || undefined,
      floor: floor ? Number(floor) : undefined,
      details: details.trim() || undefined,
      location: attach && fix ? fix.pos : undefined,
    }, online);
    setDone(report);
  };

  const reset = () => {
    setDone(null);
    setCode('');
    setPlaceId('');
    setFloor('');
    setDetails('');
    setAttach(false);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.iconButton} onClick={back} aria-label={t('search.back')}>
          <BackIcon />
        </button>
        <h2 ref={titleRef} tabIndex={-1}>{t('report.title')}</h2>
      </header>

      <div className={styles.body}>
        {done ? (
          <div className={done.status === 'sent' ? styles.sent : styles.saved} role="status">
            <p>{t(done.status === 'sent' ? 'report.sent' : 'report.saved', { code: done.code })}</p>
            <button type="button" className={styles.secondary} onClick={reset}>{t('report.another')}</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (code.trim()) send(); }}>
            <p>{t('report.intro')}</p>
            <label className={styles.field}>
              {t('report.code')}
              <input value={code} onChange={(e) => onCode(e.target.value)} required autoCapitalize="characters" autoComplete="off" aria-describedby="code-hint" />
              <span id="code-hint" className={styles.hint}>{t('report.codeHint')}</span>
            </label>
            <label className={styles.field}>
              {t('report.building')}
              <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                <option value="">{t('report.buildingUnknown')}</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.siglas} · {b.name[lang]}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              {t('report.floor')}
              <input type="number" inputMode="numeric" min={0} max={20} value={floor} onChange={(e) => setFloor(e.target.value)} />
            </label>
            <label className={styles.field}>
              {t('report.details')}
              <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t('report.detailsHint')} />
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={attach && !!fix} disabled={!fix} onChange={(e) => setAttach(e.target.checked)} />
              <span>
                {t('report.location')}
                {!fix && <span className={styles.hint}>{t('report.locationOff')}</span>}
              </span>
            </label>
            <button type="submit" className={styles.primary} disabled={!code.trim()}>{t('report.submit')}</button>
          </form>
        )}

        {reports.length > 0 && (
          <section className={styles.mine}>
            <h3>{t('report.mine')}</h3>
            <ul>
              {reports.map((r) => (
                <li key={r.id}>
                  <span className={styles.code}>{r.code}</span>
                  <span className={r.status === 'sent' ? styles.badgeSent : styles.badgeDraft}>{t(`report.status.${r.status}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
