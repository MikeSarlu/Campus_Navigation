import { CompassIcon, LanguageIcon, LocateIcon } from '../../app/icons';
import { locateMe, toggleOrientation } from '../../app/sensors';
import { useApp, useT } from '../../app/store';
import styles from './map.module.css';

export function MapControls() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const orientation = useApp((s) => s.orientation);
  const location = useApp((s) => s.location);
  const following = useApp((s) => s.following);

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.control}
        onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
        aria-label={`${t('control.language')}: ${lang.toUpperCase()}`}
      >
        <LanguageIcon />
        <span>{lang.toUpperCase()}</span>
      </button>
      <button
        type="button"
        className={styles.control}
        onClick={() => void toggleOrientation()}
        aria-pressed={orientation === 'heading'}
        aria-label={`${t('control.orientation')}: ${t(`control.orientation.${orientation}`)}`}
      >
        <CompassIcon />
        <span>{t(`control.orientation.${orientation}`)}</span>
      </button>
      <button
        type="button"
        className={styles.control}
        onClick={locateMe}
        aria-pressed={location.status === 'on' && following}
        aria-busy={location.status === 'locating'}
        aria-label={t('control.myLocation')}
      >
        <LocateIcon />
        <span>{t('control.myLocation')}</span>
      </button>
    </div>
  );
}
