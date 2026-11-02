import { useEffect } from 'react';
import styles from './app.module.css';
import { useApp, useT } from './store';

const DURATION_MS = 5_000;

export function Toast() {
  const t = useT();
  const toast = useApp((s) => s.toast);
  const hide = useApp((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, DURATION_MS);
    return () => clearTimeout(id);
  }, [toast, hide]);

  return (
    <div className={styles.toastRegion} role="status" aria-live="polite">
      {toast && (
        <button type="button" key={toast.id} className={styles.toast} onClick={hide}>
          {t(toast.message)}
        </button>
      )}
    </div>
  );
}
