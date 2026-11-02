import { create } from 'zustand';
import { locateMe } from '../../app/sensors';
import { useApp } from '../../app/store';
import type { LngLat } from '../../core/data/types';
import { buildIndoorLeg, type IndoorLeg } from '../../core/routing/indoor';
import { buildSteps, currentStepIndex, type Step } from '../../core/routing/instructions';
import { projectOnLine } from '../../core/routing/planar';
import { findRoute, snapToNetwork, type Route } from '../../core/routing/route';
import { routeTargets } from '../../core/routing/targets';
import type { LocationFix } from '../../core/sensors/location';

/** Separación de la ruta (m) a partir de la cual una lectura cuenta como "fuera de ruta". */
const OFF_ROUTE_M = 20;
/** Solo se confía en lecturas con esta precisión o mejor para decidir un recálculo. */
const TRUSTED_ACCURACY_M = 25;
/** Lecturas seguidas fuera de ruta antes de recalcular. */
const OFF_ROUTE_READINGS = 3;
/** A esta distancia del final se ofrece "Llegué" de forma destacada. */
export const NEAR_END_M = 25;
/** Si el punto de partida está más lejos que esto de cualquier camino, se avisa. */
const OFF_CAMPUS_M = 150;

export type NavPhase = 'idle' | 'choosingStart' | 'active' | 'indoor' | 'arrived';

interface NavState {
  phase: NavPhase;
  /** 'gps' sigue la ubicación; 'manual' avanza paso a paso con botones (sin GPS). */
  mode: 'gps' | 'manual';
  route: Route | null;
  steps: Step[];
  stepIndex: number;
  alongM: number;
  offRouteReadings: number;
  /** Esperando que el usuario toque su punto de partida en el mapa. */
  pickingOnMap: boolean;
  /** Tramo dentro del edificio (fase 'indoor'): se avanza con Siguiente/Anterior. */
  indoor: IndoorLeg | null;
  indoorIndex: number;
  /** Piso que muestra el plano (sigue al paso, pero el usuario puede ver otros). */
  viewLevel: number | null;
  show3D: boolean;

  begin: () => void;
  startFrom: (pos: LngLat, mode: 'gps' | 'manual') => void;
  setPickingOnMap: (picking: boolean) => void;
  onFix: (fix: LocationFix) => void;
  next: () => void;
  prev: () => void;
  arrive: () => void;
  /** "Estoy en la entrada": pasa a la guía dentro del edificio. */
  enterIndoor: () => void;
  indoorGo: (delta: 1 | -1) => void;
  setViewLevel: (level: number) => void;
  setShow3D: (show: boolean) => void;
  reset: () => void;
}

const initial = {
  phase: 'idle' as NavPhase, mode: 'gps' as const, route: null, steps: [], stepIndex: 0, alongM: 0, offRouteReadings: 0,
  pickingOnMap: false, indoor: null, indoorIndex: 0, viewLevel: null, show3D: false,
};

export const useNav = create<NavState>((set, get) => ({
  ...initial,

  /** Botón "Caminar": usa el GPS si ya hay ubicación; si no, pide elegir el punto de partida. */
  begin: () => {
    const app = useApp.getState();
    app.openNavigate();
    const fix = app.location.status === 'on' ? app.location.fix : undefined;
    if (fix) get().startFrom(fix.pos, 'gps');
    else set({ ...initial, phase: 'choosingStart' });
  },

  startFrom: (pos, mode) => {
    const app = useApp.getState();
    if (app.campus.status !== 'ready' || !app.destination) return;
    const data = app.campus.data;
    const route = findRoute(data, pos, routeTargets(app.destination, data));
    if (!route) {
      app.showToast('nav.noRoute');
      set({ ...initial, phase: 'choosingStart' });
      return;
    }
    if ((snapToNetwork(data, pos)?.distM ?? 0) > OFF_CAMPUS_M) app.showToast('nav.offCampus');
    set({ ...initial, phase: 'active', mode, route, steps: buildSteps(route) });
    app.setFollowing(mode === 'gps');
  },

  setPickingOnMap: (pickingOnMap) => set({ pickingOnMap }),

  onFix: (fix) => {
    const s = get();
    if (s.phase === 'choosingStart' && !s.pickingOnMap) {
      // El usuario pidió usar su ubicación y acaba de llegar la primera lectura.
      get().startFrom(fix.pos, 'gps');
      return;
    }
    if (s.phase !== 'active' || s.mode !== 'gps' || !s.route) return;
    const { alongM, offM } = projectOnLine(fix.pos, s.route.outdoorCoords);
    if (offM > OFF_ROUTE_M && fix.accuracyM <= TRUSTED_ACCURACY_M) {
      if (s.offRouteReadings + 1 >= OFF_ROUTE_READINGS) {
        useApp.getState().showToast('nav.rerouting');
        get().startFrom(fix.pos, 'gps');
      } else {
        set({ offRouteReadings: s.offRouteReadings + 1 });
      }
      return;
    }
    set({ alongM, offRouteReadings: 0, stepIndex: currentStepIndex(s.steps, alongM) });
  },

  next: () => set((s) => {
    const stepIndex = Math.min(s.steps.length - 1, s.stepIndex + 1);
    return { stepIndex, alongM: s.steps[stepIndex].alongM };
  }),
  prev: () => set((s) => {
    const stepIndex = Math.max(0, s.stepIndex - 1);
    return { stepIndex, alongM: s.steps[stepIndex].alongM };
  }),

  arrive: () => set({ phase: 'arrived', show3D: false }),

  enterIndoor: () => {
    const { route } = get();
    const app = useApp.getState();
    const leg = route && app.campus.status === 'ready' ? buildIndoorLeg(route, app.campus.data) : null;
    if (!leg) {
      get().arrive();
      return;
    }
    // La vista 3D se muestra una vez al entrar, como resumen del recorrido (docs/DISENO.md §6.8).
    set({ phase: 'indoor', indoor: leg, indoorIndex: 0, viewLevel: leg.steps[0].level, show3D: true });
  },
  indoorGo: (delta) => set((s) => {
    if (!s.indoor) return {};
    const indoorIndex = Math.max(0, Math.min(s.indoor.steps.length - 1, s.indoorIndex + delta));
    const step = s.indoor.steps[indoorIndex];
    // En una escalera se muestra el piso de salida, para ubicarla; el siguiente paso ya está en el nuevo piso.
    return { indoorIndex, viewLevel: step.level };
  }),
  setViewLevel: (viewLevel) => set({ viewLevel }),
  setShow3D: (show3D) => set({ show3D }),
  reset: () => set(initial),
}));

// Cada lectura nueva de GPS actualiza el progreso.
useApp.subscribe((state, prev) => {
  if (state.location.fix && state.location.fix !== prev.location.fix) useNav.getState().onFix(state.location.fix);
  // Salir de la vista de navegación (Detener o botón Atrás) termina la navegación.
  if (prev.view === 'navigate' && state.view !== 'navigate') useNav.getState().reset();
});

/** "Usar mi ubicación" en el selector de partida. */
export function startWithMyLocation(): void {
  useNav.getState().setPickingOnMap(false);
  const fix = useApp.getState().location.fix;
  if (fix && useApp.getState().location.status === 'on') useNav.getState().startFrom(fix.pos, 'gps');
  else locateMe();
}
