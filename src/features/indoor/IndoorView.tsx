import { lazy, Suspense } from 'react';
import { TurnIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import { useFocusOnMount } from '../../app/useFocusOnMount';
import { useNav } from '../navigation/navStore';
import { arrivalName, indoorStepText } from '../navigation/stepText';
import { IndoorPlan } from './IndoorPlan';
import styles from './indoor.module.css';

// three.js pesa: se descarga solo al abrir la vista 3D.
const Indoor3D = lazy(() => import('./Indoor3D').then((m) => ({ default: m.Indoor3D })));

const ICON: Record<string, string> = { enter: 'enter', walk: 'start', stairs: 'stairs', elevator: 'elevator', arrive: 'arrive' };

/** Guía paso a paso dentro del edificio, con plano del piso o vista 3D. */
export function IndoorView() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const campus = useApp((s) => s.campus);
  const destination = useApp((s) => s.destination);
  const back = useApp((s) => s.back);
  const { indoor, indoorIndex, viewLevel, show3D } = useNav();
  const { indoorGo, setViewLevel, setShow3D, arrive } = useNav.getState();
  const topRef = useFocusOnMount<HTMLElement>();

  if (campus.status !== 'ready' || !indoor || !destination || viewLevel === null) return null;
  const building = campus.data.buildings.find((b) => b.id === indoor.buildingId);
  if (!building) return null;

  const step = indoor.steps[indoorIndex];
  const last = indoorIndex === indoor.steps.length - 1;
  const text = indoorStepText(step, destination, t, lang);
  const routeLevels = new Set(indoor.steps.map((s) => s.level));

  return (
    <div className={styles.screen}>
      <section ref={topRef} tabIndex={-1} className={styles.top} aria-live="polite" aria-atomic="true">
        <div className={styles.instruction}>
          <TurnIcon kind={step.kind === 'turn' ? step.turn! : ICON[step.kind]} />
          <div>
            <p className={styles.main}>{text.main}</p>
            {text.sub && <p className={styles.sub}>{text.sub}</p>}
          </div>
        </div>
        <div className={styles.stepper}>
          <button type="button" className={styles.secondary} onClick={() => indoorGo(-1)} disabled={indoorIndex === 0}>{t('nav.prev')}</button>
          <span>{t('nav.step', { n: indoorIndex + 1, total: indoor.steps.length })}</span>
          <button type="button" className={styles.secondary} onClick={() => indoorGo(1)} disabled={last}>{t('nav.next')}</button>
        </div>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.floors} role="group" aria-label={t('indoor.floors')}>
          {building.floors.map((f) => (
            <button key={f.level} type="button" className={styles.floorButton} aria-pressed={!show3D && f.level === viewLevel}
              data-route={routeLevels.has(f.level)} onClick={() => { setShow3D(false); setViewLevel(f.level); }}>
              {t('indoor.floor', { floor: f.level })}
            </button>
          ))}
        </div>
        <button type="button" className={styles.toggle} onClick={() => setShow3D(!show3D)}>
          {show3D ? t('indoor.view2d') : t('indoor.view3d')}
        </button>
      </div>

      <div className={styles.view}>
        {show3D ? (
          <Suspense fallback={null}>
            <Indoor3D data={campus.data} building={building} leg={indoor} stepIndex={indoorIndex} label={t('indoor.model')} floorLabel={t('indoor.floor', { floor: '#' })} />
          </Suspense>
        ) : (
          <IndoorPlan data={campus.data} building={building} level={viewLevel} leg={indoor} stepIndex={indoorIndex} />
        )}
      </div>

      <section className={styles.bottom}>
        <p>{arrivalName(destination, lang)}{destination.type === 'room' ? ` · ${destination.code}` : ''}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.stop} onClick={back}>{t('nav.stop')}</button>
          {last && <button type="button" className={styles.arrive} onClick={arrive}>{t('nav.arrived')}</button>}
        </div>
      </section>
    </div>
  );
}
