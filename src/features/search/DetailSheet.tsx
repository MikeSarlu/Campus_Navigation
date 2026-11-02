import { useMemo } from 'react';
import { ClearIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import { haversineM } from '../../core/geo';
import { findRoute } from '../../core/routing/route';
import { routeTargets } from '../../core/routing/targets';
import { resultLocation } from '../../core/search';
import { useNav } from '../navigation/navStore';
import { etaMinutes, roundDistance } from '../navigation/stepText';
import { resultSubtitle, resultTitle } from './resultText';
import styles from './search.module.css';

/** Panel inferior con el destino elegido y el botón para empezar a caminar. */
export function DetailSheet() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const destination = useApp((s) => s.destination);
  const campus = useApp((s) => s.campus);
  const userPos = useApp((s) => s.location.fix?.pos);
  const back = useApp((s) => s.back);
  const begin = useNav((s) => s.begin);

  const data = campus.status === 'ready' ? campus.data : null;
  const targets = useMemo(() => (destination && data ? routeTargets(destination, data) : []), [destination, data]);
  // Vista previa del tiempo cuando ya se conoce la ubicación (no se recalcula con cada lectura del GPS).
  const roundedPos = userPos && `${userPos[0].toFixed(4)},${userPos[1].toFixed(4)}`;
  const preview = useMemo(
    () => (data && userPos && targets.length ? findRoute(data, userPos, targets) : null),
    [data, targets, roundedPos],
  );
  if (!destination) return null;

  const loc = resultLocation(destination) ?? (destination.type === 'building' ? destination.place.location : undefined);
  const distance = loc && userPos ? roundDistance(haversineM(userPos, loc)) : null;

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
      {preview ? (
        <p className={styles.sheetMeta}>{t('detail.eta', { min: etaMinutes(preview.etaS), m: roundDistance(preview.lengthM) })}</p>
      ) : (
        distance !== null && <p className={styles.sheetMeta}>{t('detail.distance', { m: distance })}</p>
      )}
      {targets.length > 0 && (
        <button type="button" className={styles.walk} onClick={begin}>{t('detail.walk')}</button>
      )}
    </section>
  );
}
