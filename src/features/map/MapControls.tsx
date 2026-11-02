import { CompassIcon, LanguageIcon, LocateIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import styles from './map.module.css';

export function MapControls() {
  const t = useT();
  const { lang, setLang, orientation, toggleOrientation } = useApp();

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
        onClick={toggleOrientation}
        aria-label={`${t('control.orientation')}: ${t(`control.orientation.${orientation}`)}`}
      >
        <CompassIcon />
        <span>{t(`control.orientation.${orientation}`)}</span>
      </button>
      <button type="button" className={styles.control} aria-label={t('control.myLocation')}>
        <LocateIcon />
        <span>{t('control.myLocation')}</span>
      </button>
    </div>
  );
}
