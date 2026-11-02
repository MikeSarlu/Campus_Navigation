import { useMemo, type ReactNode } from 'react';
import { LocateIcon, TurnIcon } from '../../app/icons';
import { useApp, useT } from '../../app/store';
import { useFocusOnMount } from '../../app/useFocusOnMount';
import type { Step } from '../../core/routing/instructions';
import { NEAR_END_M, startWithMyLocation, useNav } from './navStore';
import styles from './navigation.module.css';
import { arrivalName, etaMinutes, floorHint, maneuverText, roundDistance } from './stepText';
import { WALK_SPEED_MPS } from '../../core/routing/route';

/** Pantalla de navegación: elegir partida, seguir la ruta o confirmar la llegada. */
export function NavigationView({ controls }: { controls: ReactNode }) {
  const phase = useNav((s) => s.phase);
  return (
    <div className={styles.layer}>
      {phase === 'choosingStart' && <StartPicker />}
      {phase === 'active' && <ActiveNavigation controls={controls} />}
      {phase !== 'active' && <div className={styles.spacer} />}
      {phase === 'choosingStart' && <div className={styles.controls}>{controls}</div>}
      {phase === 'arrived' && <Arrived />}
    </div>
  );
}

function StartPicker() {
  const t = useT();
  const back = useApp((s) => s.back);
  const locating = useApp((s) => s.location.status === 'locating');
  const campus = useApp((s) => s.campus);
  const lang = useApp((s) => s.lang);
  const picking = useNav((s) => s.pickingOnMap);
  const { setPickingOnMap, startFrom } = useNav.getState();
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  const sorted = useMemo(
    () => (campus.status === 'ready' ? campus.data.places.filter((p) => p.location) : [])
      .sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang)),
    [campus, lang],
  );

  return (
    <section className={styles.topCard} aria-labelledby="start-title">
      <h2 id="start-title" ref={titleRef} tabIndex={-1} className={styles.cardTitle}>{t('start.title')}</h2>
      <div className={styles.startOptions}>
        <button type="button" className={styles.primary} onClick={startWithMyLocation} aria-busy={locating}>
          <LocateIcon /> {locating ? t('start.locating') : t('start.gps')}
        </button>
        <button type="button" className={styles.secondary} aria-pressed={picking} onClick={() => setPickingOnMap(!picking)}>
          {t('start.map')}
        </button>
        {sorted.length > 0 && (
          <select
            className={styles.select}
            value=""
            aria-label={t('start.place')}
            onChange={(e) => {
              const place = sorted.find((p) => p.id === e.target.value);
              if (place?.location) startFrom(place.location, 'manual');
            }}
          >
            <option value="">{t('start.place')}</option>
            {sorted.map((p) => <option key={p.id} value={p.id}>{p.siglas ? `${p.siglas} · ` : ''}{p.name[lang]}</option>)}
          </select>
        )}
      </div>
      {picking && <p className={styles.hint} role="status">{t('start.mapHint')}</p>}
      <button type="button" className={styles.link} onClick={back}>{t('start.cancel')}</button>
    </section>
  );
}

function Instruction({ main, sub, step }: { main: string; sub?: string; step?: Step }) {
  return (
    <div className={styles.instruction}>
      {step && <TurnIcon kind={step.kind === 'turn' ? step.turn : step.kind} />}
      <div>
        <p className={styles.instructionMain}>{main}</p>
        {sub && <p className={styles.instructionSub}>{sub}</p>}
      </div>
    </div>
  );
}

function ActiveNavigation({ controls }: { controls: ReactNode }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const destination = useApp((s) => s.destination);
  const fix = useApp((s) => s.location.fix);
  const following = useApp((s) => s.following);
  const back = useApp((s) => s.back);
  const { mode, route, steps, stepIndex, alongM } = useNav();
  const { next, prev, arrive, enterIndoor } = useNav.getState();
  const cardRef = useFocusOnMount<HTMLElement>();
  if (!route || !destination || !steps.length) return null;

  const last = steps.length - 1;
  const current = steps[stepIndex];
  const upcoming = steps[stepIndex + 1];
  const say = (s: Step) => maneuverText(s, destination, t, lang);

  let instruction;
  if (mode === 'manual') {
    instruction = (
      <Instruction step={current} main={say(current)} sub={current.distanceM > 0 ? t('nav.walk', { m: roundDistance(current.distanceM) }) : undefined} />
    );
  } else if (stepIndex === 0 && alongM < 15 && upcoming) {
    instruction = (
      <Instruction step={current} main={say(current)}
        sub={t('nav.then', { text: `${say(upcoming)} ${t('nav.in', { m: roundDistance(upcoming.alongM - alongM) })}` })} />
    );
  } else if (upcoming) {
    instruction = <Instruction step={upcoming} main={say(upcoming)} sub={t('nav.in', { m: roundDistance(upcoming.alongM - alongM) })} />;
  } else {
    instruction = <Instruction step={current} main={say(current)} />;
  }

  const remainingM = Math.max(0, route.lengthM - alongM);
  const nearEnd = mode === 'gps' ? route.outdoorLengthM - alongM <= NEAR_END_M : stepIndex === last;
  // Si la ruta sigue dentro de un edificio con plano, al final se pasa a la guía interior.
  const hasIndoor = route.indoorFrom < route.nodes.length;
  const hint = nearEnd && !hasIndoor ? floorHint(destination, t) : null;
  const approx = mode === 'gps' && fix && fix.accuracyM > 30;

  return (
    <>
      <section ref={cardRef} tabIndex={-1} className={styles.topCard} aria-live="polite" aria-atomic="true">
        {instruction}
        {hint && <p className={styles.floorHint}>{hint}</p>}
        {approx && <p className={styles.approx}>{t('nav.approx', { m: Math.round(fix.accuracyM) })}</p>}
        {mode === 'manual' && (
          <div className={styles.stepper}>
            <button type="button" className={styles.secondary} onClick={prev} disabled={stepIndex === 0}>{t('nav.prev')}</button>
            <span>{t('nav.step', { n: stepIndex + 1, total: steps.length })}</span>
            <button type="button" className={styles.secondary} onClick={next} disabled={stepIndex === last}>{t('nav.next')}</button>
          </div>
        )}
      </section>
      <div className={styles.spacer} />
      <div className={styles.controls}>{controls}</div>

      <section className={styles.bottomCard}>
        {mode === 'gps' && !following && (
          <button type="button" className={styles.recenter} onClick={() => useApp.getState().setFollowing(true)}>
            <LocateIcon /> {t('nav.recenter')}
          </button>
        )}
        <div className={styles.summary}>
          <p className={styles.summaryTitle}>{arrivalName(destination, lang)}</p>
          <p>
            {t('nav.etaLabel')}: <strong>{t('nav.eta', { min: etaMinutes(remainingM / WALK_SPEED_MPS), m: roundDistance(remainingM) })}</strong>
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.stop} onClick={back}>{t('nav.stop')}</button>
          {nearEnd && (hasIndoor
            ? <button type="button" className={styles.arrive} onClick={enterIndoor}>{t('indoor.atEntrance')}</button>
            : <button type="button" className={styles.arrive} onClick={arrive}>{t('nav.arrived')}</button>)}
        </div>
      </section>
    </>
  );
}

function Arrived() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const destination = useApp((s) => s.destination);
  const goHome = useApp((s) => s.goHome);
  const titleRef = useFocusOnMount<HTMLParagraphElement>();
  if (!destination) return null;
  const name = destination.type === 'place' ? destination.place.name[lang] : destination.type === 'room' ? destination.code : destination.code.code;
  return (
    <section className={styles.arrived} role="status" aria-live="assertive">
      <p ref={titleRef} tabIndex={-1} className={styles.arrivedTitle}>{t('arrived.title')}</p>
      <p className={styles.arrivedName}>{name}</p>
      <button type="button" className={styles.done} onClick={goHome}>{t('arrived.done')}</button>
    </section>
  );
}
