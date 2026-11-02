import { create } from 'zustand';
import type { CampusData, CategoryId } from '../core/data/types';
import { detectLanguage, translate, type Lang, type MessageKey } from '../core/i18n/i18n';
import type { SearchResult } from '../core/search';
import type { LocationFix, LocationStatus } from '../core/sensors/location';

export type Orientation = 'north' | 'heading';
export type View = 'home' | 'search' | 'detail';

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
  /** true cuando la app muestra el borrador del editor (?datos=editor). */
  previewingDraft: boolean;

  view: View;
  query: string;
  category: CategoryId | null;
  destination: SearchResult | null;

  location: { status: LocationStatus; fix?: LocationFix };
  /** El mapa sigue al usuario hasta que este lo mueve con el dedo. */
  following: boolean;
  heading: number | null;
  toast: { message: MessageKey; id: number } | null;

  setLang: (lang: Lang) => void;
  setOrientation: (o: Orientation) => void;
  setCampus: (campus: DataState, previewingDraft?: boolean) => void;
  setQuery: (query: string) => void;
  openSearch: (category?: CategoryId) => void;
  openDetail: (result: SearchResult) => void;
  /** Vuelve a la vista anterior usando el historial, igual que el botón Atrás del teléfono. */
  back: () => void;
  syncView: (view: View) => void;
  setLocation: (location: AppState['location']) => void;
  setFollowing: (following: boolean) => void;
  setHeading: (heading: number | null) => void;
  showToast: (message: MessageKey) => void;
  hideToast: () => void;
}

const DEPTH: Record<View, number> = { home: 0, search: 1, detail: 2 };

/** Cada vista abierta es una entrada del historial, para que el botón Atrás la cierre. */
function pushView(view: View) {
  history.pushState({ view }, '');
}

export const useApp = create<AppState>((set, get) => ({
  lang: readStoredLang() ?? detectLanguage(navigator.languages ?? [navigator.language]),
  orientation: 'north',
  campus: { status: 'loading' },
  previewingDraft: false,
  view: 'home',
  query: '',
  category: null,
  destination: null,
  location: { status: 'off' },
  following: false,
  heading: null,
  toast: null,

  setLang: (lang) => {
    storeLang(lang);
    document.documentElement.lang = lang;
    set({ lang });
  },
  setOrientation: (orientation) => set({ orientation, heading: orientation === 'north' ? null : get().heading }),
  setCampus: (campus, previewingDraft = false) => set({ campus, previewingDraft }),
  setQuery: (query) => set({ query, category: null }),

  openSearch: (category) => {
    // Desde el detalle, la búsqueda ya está en el historial: se vuelve a ella.
    if (get().view === 'detail') {
      history.back();
      return;
    }
    if (get().view !== 'search') pushView('search');
    set({ view: 'search', category: category ?? null, query: category ? '' : get().query });
  },
  openDetail: (destination) => {
    pushView('detail');
    set({ view: 'detail', destination });
  },
  back: () => {
    if (get().view === 'home') return;
    history.back();
  },
  syncView: (view) => {
    const current = get().view;
    if (DEPTH[view] >= DEPTH[current]) return;
    // Al salir de la búsqueda se limpia; al salir del detalle se vuelve a los resultados.
    set(view === 'home' ? { view, query: '', category: null, destination: null } : { view, destination: null });
  },

  setLocation: (location) => set({ location }),
  setFollowing: (following) => set({ following }),
  setHeading: (heading) => set({ heading }),
  showToast: (message) => set({ toast: { message, id: Date.now() } }),
  hideToast: () => set({ toast: null }),
}));

export function useT() {
  const lang = useApp((s) => s.lang);
  return (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params);
}
