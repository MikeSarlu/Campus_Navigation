import type { Lang } from '../../core/i18n/i18n';
import { translate } from '../../core/i18n/i18n';
import type { SearchResult } from '../../core/search';

export function resultTitle(r: SearchResult, lang: Lang): string {
  if (r.type === 'room') return r.code;
  if (r.type === 'building') return r.code.code;
  return r.place.name[lang];
}

/** Segunda línea: dónde está (edificio y piso) o qué tipo de lugar es. */
export function resultSubtitle(r: SearchResult, lang: Lang): string {
  const floor = (n: number) => translate(lang, 'result.floor', { floor: n });
  if (r.type === 'room') return [r.building && `${r.building.siglas} · ${r.building.name[lang]}`, floor(r.floor)].filter(Boolean).join(' · ');
  if (r.type === 'building') return `${r.place.siglas} · ${r.place.name[lang]} · ${floor(r.code.floor)}`;
  const kind = translate(lang, `kind.${r.place.kind}`);
  return r.place.siglas ? `${kind} · ${r.place.siglas}` : kind;
}
