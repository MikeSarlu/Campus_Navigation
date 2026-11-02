// Borrador del editor guardado en IndexedDB. Lo escribe el editor y la app lo puede leer
// con ?datos=editor para revisar el trabajo antes de exportarlo.
import { createStore, get } from 'idb-keyval';
import type { CampusData } from './types';

export const editorDb = createStore('campus-editor', 'kv');
export const DRAFT_KEY = 'data';

export function loadEditorDraft(): Promise<CampusData | undefined> {
  return get<CampusData>(DRAFT_KEY, editorDb);
}
