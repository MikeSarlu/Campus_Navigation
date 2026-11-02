import { create } from 'zustand';
import type { CampusData } from '../core/data/types';
import { detectLanguage, translate, type Lang, type MessageKey } from '../core/i18n/i18n';

export type Orientation = 'north' | 'heading';

const LANG_KEY = 'campus.lang';

// El almacenamiento puede no estar disponible (modo privado); la app funciona igual sin él.
function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'es' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

function storeLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* sin almacenamiento */
  }
}

type DataState =
  | { status: 'loading' }
  | { status: 'ready'; data: CampusData }
  | { status: 'error'; message: string };

interface AppState {
  lang: Lang;
  orientation: Orientation;
  campus: DataState;
  setLang: (lang: Lang) => void;
  toggleOrientation: () => void;
  setCampus: (campus: DataState) => void;
}

export const useApp = create<AppState>((set) => ({
  lang: readStoredLang() ?? detectLanguage(navigator.languages ?? [navigator.language]),
  orientation: 'north',
  campus: { status: 'loading' },
  setLang: (lang) => {
    storeLang(lang);
    document.documentElement.lang = lang;
    set({ lang });
  },
  toggleOrientation: () => set((s) => ({ orientation: s.orientation === 'north' ? 'heading' : 'north' })),
  setCampus: (campus) => set({ campus }),
}));

export function useT() {
  const lang = useApp((s) => s.lang);
  return (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params);
}
