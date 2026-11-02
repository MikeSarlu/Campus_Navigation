import type { Localized, LngLat } from '../data/types';
import { bearing, toMeters, turnAngle } from './planar';
import type { Route } from './route';

export type Turn = 'slightLeft' | 'left' | 'slightRight' | 'right' | 'uturn';
export type Cardinal = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type Step =
  | { kind: 'start'; alongM: number; distanceM: number; heading: Cardinal }
  | { kind: 'turn'; alongM: number; distanceM: number; turn: Turn; landmark?: Localized }
  /** Fin del tramo exterior: el destino, o la entrada del edificio si sigue un tramo interior. */
  | { kind: 'arrive' | 'enter'; alongM: number; distanceM: 0; landmark?: Localized };

/** Giros menores a esto se consideran "seguir derecho". */
const MIN_TURN_DEG = 35;
/** Distancia para medir la dirección antes y después de un vértice (suaviza curvas dibujadas con muchos puntos). */
const LOOK_M = 8;
/** Dos giros más cerca que esto se funden en uno (el mayor). */
const MERGE_M = 10;

export function cardinal(deg: number): Cardinal {
  return (['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const)[Math.round(deg / 45) % 8];
}

function classify(angle: number): Turn {
  const a = Math.abs(angle);
  if (a > 135) return 'uturn';
  if (a < 60) return angle < 0 ? 'slightLeft' : 'slightRight';
  return angle < 0 ? 'left' : 'right';
}

/** Pasos del tramo exterior de una ruta, con la distancia acumulada donde empieza cada uno. */
export function buildSteps(route: Route): Step[] {
  const outdoor = route.nodes.slice(0, route.indoorFrom).filter((n) => n.pos);
  const pts: LngLat[] = outdoor.map((n) => n.pos!);
  const enter = route.indoorFrom < route.nodes.length;
  const end: Step = { kind: enter ? 'enter' : 'arrive', alongM: route.outdoorLengthM, distanceM: 0, landmark: outdoor.at(-1)?.node?.label };
  if (pts.length < 2) return [end];

  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(...toMeters(pts[i], pts[i - 1])));

  const turns: { i: number; angle: number }[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    let j = i - 1;
    while (j > 0 && cum[i] - cum[j] < LOOK_M) j--;
    let k = i + 1;
    while (k < pts.length - 1 && cum[k] - cum[i] < LOOK_M) k++;
    const angle = turnAngle(bearing(pts[j], pts[i]), bearing(pts[i], pts[k]));
    if (Math.abs(angle) < MIN_TURN_DEG) continue;
    const last = turns.at(-1);
    if (last && cum[i] - cum[last.i] < MERGE_M) {
      if (Math.abs(angle) > Math.abs(last.angle)) turns[turns.length - 1] = { i, angle };
    } else {
      turns.push({ i, angle });
    }
  }

  const steps: Step[] = [{ kind: 'start', alongM: 0, distanceM: 0, heading: cardinal(bearing(pts[0], pts[Math.min(1, pts.length - 1)])) }];
  for (const { i, angle } of turns) {
    steps.push({ kind: 'turn', alongM: cum[i], distanceM: 0, turn: classify(angle), landmark: outdoor[i].node?.label });
  }
  steps.push({ ...end, alongM: cum.at(-1)! });
  for (let s = 0; s < steps.length - 1; s++) steps[s].distanceM = steps[s + 1].alongM - steps[s].alongM;
  return steps;
}

/** Paso en el que va el usuario según la distancia recorrida. */
export function currentStepIndex(steps: Step[], alongM: number): number {
  let idx = 0;
  // Se cambia al siguiente paso un poco antes de llegar al giro, para anunciarlo a tiempo.
  for (let s = 1; s < steps.length; s++) if (steps[s].alongM - 5 <= alongM) idx = s;
  return idx;
}
