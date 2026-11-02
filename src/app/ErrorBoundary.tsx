import { Component, type ReactNode } from 'react';
import { translate } from '../core/i18n/i18n';
import styles from './app.module.css';
import { useApp } from './store';

/**
 * Si algo falla al dibujar la app, muestra un aviso con "Volver a cargar" en lugar de dejar la
 * pantalla en blanco.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Error en la app:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const lang = useApp.getState().lang;
    return (
      <div className={styles.crash} role="alert">
        <p>{translate(lang, 'crash.message')}</p>
        <button type="button" onClick={() => window.location.reload()}>{translate(lang, 'crash.reload')}</button>
      </div>
    );
  }
}
