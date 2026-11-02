import { en } from './en';
import { es, type MessageKey } from './es';

export type Lang = 'es' | 'en';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { es, en };

/** Primer idioma del navegador que sea español o inglés; si ninguno, español. */
export function detectLanguage(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'es' || base === 'en') return base;
  }
  return 'es';
}

export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  const text = dictionaries[lang][key];
  return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`)) : text;
}

export type { MessageKey };
