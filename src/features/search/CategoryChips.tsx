import { useT } from '../../app/store';
import type { CategoryId } from '../../core/data/types';
import styles from './search.module.css';

const CATEGORIES: CategoryId[] = ['comedor', 'gimnasio', 'medico', 'escolares', 'biblioteca', 'internacional'];

export function CategoryChips() {
  const t = useT();
  return (
    <ul className={styles.chips}>
      {CATEGORIES.map((id) => (
        <li key={id}>
          <button type="button" className={styles.chip}>
            {t(`category.${id}`)}
          </button>
        </li>
      ))}
    </ul>
  );
}
