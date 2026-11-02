import { useT } from '../../app/store';
import styles from './map.module.css';

// Se reemplaza por MapLibre + PMTiles en la fase 2.
export function MapPlaceholder() {
  const t = useT();
  return (
    <div className={styles.map} aria-hidden="true">
      <span>{t('map.placeholder')}</span>
    </div>
  );
}
