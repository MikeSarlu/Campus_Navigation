// Autoguardado del editor en IndexedDB (los fondos pueden pesar varios MB, demasiado para localStorage).
import { createStore, del, entries, get, set } from 'idb-keyval';
import { loadCampus } from '../../core/data/loadCampus';
import type { CampusData } from '../../core/data/types';
import { useEditor, type Background } from './editorStore';

const store = createStore('campus-editor', 'kv');
const DATA_KEY = 'data';
const BG_PREFIX = 'bg:';

type StoredBackground = Omit<Background, 'url'> & { blob: Blob };

let initPromise: Promise<'autosave' | 'published'> | null = null;

/** Carga el autoguardado o, si no hay, el campus.json publicado. Solo corre una vez. */
export function initEditor(): Promise<'autosave' | 'published'> {
  initPromise ??= (async () => {
    const saved = await get<CampusData>(DATA_KEY, store).catch(() => undefined);
    useEditor.getState().load(saved ?? (await loadCampus()));
    await restoreBackgrounds();
    startAutosave();
    return saved ? 'autosave' : 'published';
  })();
  return initPromise;
}

/** Descarta el trabajo local y vuelve a cargar el campus.json publicado (se puede deshacer). */
export async function reloadPublished(): Promise<void> {
  useEditor.getState().load(await loadCampus());
}

let autosaveStarted = false;
function startAutosave() {
  if (autosaveStarted) return;
  autosaveStarted = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  useEditor.subscribe((state, prev) => {
    if (state.data === prev.data || !state.data) return;
    clearTimeout(timer);
    const data = state.data;
    timer = setTimeout(() => void set(DATA_KEY, data, store).catch((e) => console.error('Autoguardado falló', e)), 400);
  });
}

async function restoreBackgrounds() {
  const all = await entries<string, StoredBackground>(store).catch(() => []);
  for (const [key, { blob, ...rest }] of all) {
    if (!String(key).startsWith(BG_PREFIX)) continue;
    useEditor.getState().setBackground(String(key).slice(BG_PREFIX.length), { ...rest, url: URL.createObjectURL(blob) });
  }
}

export async function saveBackground(key: string, blob: Blob, bg: Omit<Background, 'url'>): Promise<void> {
  const previous = useEditor.getState().backgrounds[key];
  if (previous) URL.revokeObjectURL(previous.url);
  useEditor.getState().setBackground(key, { ...bg, url: URL.createObjectURL(blob) });
  await set(BG_PREFIX + key, { ...bg, blob } satisfies StoredBackground, store);
}

/** Actualiza escala, posición u opacidad sin volver a guardar la imagen. */
export async function updateBackground(key: string, patch: Partial<Omit<Background, 'url'>>): Promise<void> {
  const current = useEditor.getState().backgrounds[key];
  if (!current) return;
  useEditor.getState().setBackground(key, { ...current, ...patch });
  const stored = await get<StoredBackground>(BG_PREFIX + key, store);
  if (stored) await set(BG_PREFIX + key, { ...stored, ...patch }, store);
}

export async function removeBackground(key: string): Promise<void> {
  const current = useEditor.getState().backgrounds[key];
  if (current) URL.revokeObjectURL(current.url);
  useEditor.getState().setBackground(key, null);
  await del(BG_PREFIX + key, store);
}

export function exportCampus(data: CampusData): void {
  const out: CampusData = { ...data, generatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'campus.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importCampus(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as CampusData;
  if (!Array.isArray(parsed.places) || !Array.isArray(parsed.buildings) || !parsed.graph?.nodes) {
    throw new Error('El archivo no parece un campus.json');
  }
  useEditor.getState().load(parsed);
}
