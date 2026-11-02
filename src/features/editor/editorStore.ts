import { create } from 'zustand';
import type { CampusData, LocalXY } from '../../core/data/types';

export type Mode = 'outdoor' | 'indoor';
export type OutdoorTool = 'select' | 'path' | 'place' | 'entrance' | 'anchor' | 'delete';
export type IndoorTool = 'select' | 'corridor' | 'outline' | 'room' | 'door' | 'stairs' | 'entrance' | 'calibrate' | 'ref' | 'delete';

export type Selection =
  | { type: 'node'; id: string }
  | { type: 'edge'; from: string; to: string }
  | { type: 'place'; id: string }
  | { type: 'room'; code: string }
  | null;

/** Fondo de un piso (foto o croquis). Solo vive en el editor; no se exporta en campus.json. */
export interface Background {
  url: string;
  widthPx: number;
  heightPx: number;
  mPerPx: number;
  offset: LocalXY;
  opacity: number;
}

const HISTORY_LIMIT = 100;

interface EditorState {
  data: CampusData | null;
  past: CampusData[];
  future: CampusData[];
  mode: Mode;
  outdoorTool: OutdoorTool;
  indoorTool: IndoorTool;
  selection: Selection;
  buildingId: string | null;
  level: number | null;
  /** Último nodo de la cadena que se está dibujando (camino o pasillo). */
  chainFrom: string | null;
  /** Puntos del polígono en curso (contorno o salón) o de la calibración. */
  draft: LocalXY[];
  /** Polígono de salón cerrado que espera su código. */
  pendingRoom: LocalXY[] | null;
  /** Salón recién creado que espera su puerta. */
  pendingDoorFor: string | null;
  backgrounds: Record<string, Background>;
  /** Punto de referencia marcado en el plano que espera su ubicación en el mapa. */
  pendingRef: LocalXY | null;

  load: (data: CampusData) => void;
  commit: (fn: (draft: CampusData) => void) => void;
  undo: () => void;
  redo: () => void;
  setMode: (mode: Mode) => void;
  setOutdoorTool: (tool: OutdoorTool) => void;
  setIndoorTool: (tool: IndoorTool) => void;
  select: (selection: Selection) => void;
  setFloor: (buildingId: string | null, level: number | null) => void;
  set: (partial: Partial<Pick<EditorState, 'chainFrom' | 'draft' | 'pendingRoom' | 'pendingDoorFor' | 'pendingRef'>>) => void;
  setBackground: (key: string, bg: Background | null) => void;
}

const resetDrawing = { chainFrom: null, draft: [], pendingRoom: null, pendingDoorFor: null };

export const bgKey = (buildingId: string, level: number) => `${buildingId}:${level}`;

export const useEditor = create<EditorState>((set, get) => ({
  data: null,
  past: [],
  future: [],
  mode: 'outdoor',
  outdoorTool: 'select',
  indoorTool: 'select',
  selection: null,
  buildingId: null,
  level: null,
  ...resetDrawing,
  backgrounds: {},
  pendingRef: null,

  load: (data) => {
    const prev = get().data;
    const firstBuilding = data.buildings[0];
    set({
      data,
      past: prev ? [...get().past, prev].slice(-HISTORY_LIMIT) : [],
      future: [],
      selection: null,
      buildingId: get().buildingId ?? firstBuilding?.id ?? null,
      level: get().level ?? firstBuilding?.floors[0]?.level ?? null,
      ...resetDrawing,
    });
  },

  commit: (fn) => {
    const { data, past } = get();
    if (!data) return;
    const next = structuredClone(data);
    fn(next);
    set({ data: next, past: [...past, data].slice(-HISTORY_LIMIT), future: [] });
  },

  undo: () => {
    const { data, past, future } = get();
    if (!data || !past.length) return;
    set({ data: past[past.length - 1], past: past.slice(0, -1), future: [data, ...future], selection: null, ...resetDrawing });
  },

  redo: () => {
    const { data, past, future } = get();
    if (!data || !future.length) return;
    set({ data: future[0], past: [...past, data], future: future.slice(1), selection: null, ...resetDrawing });
  },

  setMode: (mode) => set({ mode, ...resetDrawing }),
  setOutdoorTool: (outdoorTool) => set({ outdoorTool, ...resetDrawing }),
  setIndoorTool: (indoorTool) => set({ indoorTool, ...resetDrawing }),
  select: (selection) => set({ selection }),
  setFloor: (buildingId, level) => set({ buildingId, level, selection: null, ...resetDrawing }),
  set: (partial) => set(partial),
  setBackground: (key, bg) =>
    set((s) => {
      const backgrounds = { ...s.backgrounds };
      if (bg) backgrounds[key] = bg;
      else delete backgrounds[key];
      return { backgrounds };
    }),
}));
