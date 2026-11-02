import type { Lang, MessageKey } from '../../core/i18n/i18n';
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

/** Indicación del piso y salón al entrar al edificio (la guía interior paso a paso es la fase 4). */
export function floorHint(dest: SearchResult, t: T): string | null {
  if (dest.type === 'room') return t('nav.floorHint', { floor: dest.floor, code: dest.code });
  if (dest.type === 'building') return t('nav.floorHint', { floor: dest.code.floor, code: dest.code.code });
  return null;
}
