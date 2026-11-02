import { ClearIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import { haversineM } from '../../core/geo';
import { resultLocation } from '../../core/search';
import { resultSubtitle, resultTitle } from './resultText';
import styles from './search.module.css';

/** Panel inferior con el destino elegido. La navegación ("Caminar") llega en la fase 3. */
export function DetailSheet() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const destination = useApp((s) => s.destination);
  const userPos = useApp((s) => s.location.fix?.pos);
  const back = useApp((s) => s.back);
  if (!destination) return null;

  const loc = resultLocation(destination) ?? (destination.type === 'building' ? destination.place.location : undefined);
  const distance = loc && userPos ? Math.round(haversineM(userPos, loc) / 10) * 10 : null;

  return (
    <section className={styles.sheet} aria-labelledby="detail-title">
      <div className={styles.sheetHeader}>
        <div>
          <h2 id="detail-title" className={styles.sheetTitle}>{resultTitle(destination, lang)}</h2>
          <p className={styles.sheetSubtitle}>{resultSubtitle(destination, lang)}</p>
        </div>
        <button type="button" className={styles.iconButton} onClick={back} aria-label={t('detail.close')}>
          <ClearIcon />
        </button>
      </div>
      {destination.type === 'building' && (
        <p className={styles.sheetNote}>{t('result.goToBuilding', { code: destination.code.code, floor: destination.code.floor })}</p>
      )}
      {!loc && <p className={styles.sheetNote}>{t('detail.notMapped')}</p>}
      {distance !== null && <p className={styles.sheetMeta}>{t('detail.distance', { m: distance })}</p>}
    </section>
  );
}
