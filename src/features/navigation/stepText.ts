import type { Lang, MessageKey } from '../../core/i18n/i18n';
import type { IndoorStep } from '../../core/routing/indoor';
import type { Step } from '../../core/routing/instructions';
import type { SearchResult } from '../../core/search';

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Distancias redondeadas como las diría una persona: de 5 en 5 m de cerca, de 10 en 10 de lejos. */
export function roundDistance(m: number): number {
  return m < 100 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10;
}

export function etaMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/** Nombre del lugar al que se llega al terminar el tramo exterior. */
export function arrivalName(dest: SearchResult, lang: Lang): string {
  if (dest.type === 'place') return dest.place.name[lang];
  if (dest.type === 'building') return `${dest.place.siglas} · ${dest.place.name[lang]}`;
  return dest.building ? `${dest.building.siglas} · ${dest.building.name[lang]}` : dest.code;
}

export function maneuverText(step: Step, dest: SearchResult, t: T, lang: Lang): string {
  const landmark = 'landmark' in step && step.landmark ? ` ${step.landmark[lang]}` : '';
  switch (step.kind) {
    case 'start':
      return t('nav.start', { dir: t(`dir.${step.heading}`) });
    case 'turn':
      return t(`nav.turn.${step.turn}`) + landmark;
    case 'enter':
      return t('nav.enter', { name: arrivalName(dest, lang) }) + landmark;
    case 'arrive':
      return t('nav.arrive', { name: arrivalName(dest, lang) }) + landmark;
  }
}

/** Indicación del piso y salón cuando el edificio aún no tiene plano interior para guiar paso a paso. */
export function floorHint(dest: SearchResult, t: T): string | null {
  if (dest.type === 'room') return t('nav.floorHint', { floor: dest.floor, code: dest.code });
  if (dest.type === 'building') return t('nav.floorHint', { floor: dest.code.floor, code: dest.code.code });
  return null;
}

/** Texto principal y secundario de un paso dentro del edificio. */
export function indoorStepText(step: IndoorStep, dest: SearchResult, t: T, lang: Lang): { main: string; sub?: string } {
  const landmark = step.landmark ? ` ${step.landmark[lang]}` : '';
  const walk = step.distanceM >= 1 ? t('nav.walk', { m: roundDistance(step.distanceM) }) : undefined;
  switch (step.kind) {
    case 'enter':
      return { main: t('indoor.enter') + landmark, sub: walk };
    case 'walk':
      return { main: t('indoor.walk') + landmark, sub: walk };
    case 'turn':
      return { main: t(`nav.turn.${step.turn!}`) + landmark, sub: walk };
    case 'stairs':
      return { main: t(step.toLevel! > step.level ? 'indoor.stairsUp' : 'indoor.stairsDown', { floor: step.toLevel! }) + landmark };
    case 'elevator':
      return { main: t('indoor.elevator', { floor: step.toLevel! }) + landmark };
    case 'arrive': {
      const code = dest.type === 'room' ? dest.code : dest.type === 'building' ? dest.code.code : dest.place.name[lang];
      return { main: t('indoor.arrive', { code }), sub: t(`indoor.side.${step.side ?? 'ahead'}`) };
    }
  }
}
