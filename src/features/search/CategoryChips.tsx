import { useApp, useT } from '../../app/store';
import type { CategoryId } from '../../core/data/types';
import styles from './search.module.css';

const CATEGORIES: CategoryId[] = ['comedor', 'gimnasio', 'medico', 'escolares', 'biblioteca', 'internacional'];

export function CategoryChips() {
  const t = useT();
  const openSearch = useApp((s) => s.openSearch);
  return (
    <ul className={styles.chips}>
      {CATEGORIES.map((id) => (
        <li key={id}>
          <button type="button" className={styles.chip} onClick={() => openSearch(id)}>
            {t(`category.${id}`)}
          </button>
        </li>
      ))}
    </ul>
  );
}
