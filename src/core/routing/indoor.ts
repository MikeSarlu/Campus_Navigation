// Pasos del tramo interior de una ruta: desde la entrada del edificio hasta la puerta del salón.
// Sin posicionamiento en interiores: el usuario avanza los pasos con Siguiente/Anterior.
import type { CampusData, Localized, LocalXY, Room } from '../data/types';
import type { Turn } from './instructions';
import { turnAngle } from './planar';
import type { Route, RouteNode } from './route';

export type Side = 'left' | 'right' | 'ahead';

export interface IndoorStep {
  kind: 'enter' | 'walk' | 'turn' | 'stairs' | 'elevator' | 'arrive';
  /** Piso donde ocurre el paso (en escaleras, el piso de salida). */
  level: number;
  toLevel?: number;
  turn?: Turn;
  /** Metros a caminar después de la maniobra. */
  distanceM: number;
  landmark?: Localized;
  side?: Side;
  /** Trazo de este paso sobre el plano de `level`, para resaltarlo. */
  path: LocalXY[];
}

export interface IndoorLeg {
  buildingId: string;
  steps: IndoorStep[];
  /** Ruta completa por piso, para dibujar el rastro. */
  pathsByLevel: Map<number, LocalXY[][]>;
  room?: Room;
}

const MIN_TURN_DEG = 35;
const LOOK_M = 2;
const MERGE_M = 3;

/** Rumbo en el plano: el "arriba" del plano (−y) es 0°. */
function planBearing(a: LocalXY, b: LocalXY): number {
  return ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI + 360) % 360;
}

function classify(angle: number): Turn {
  const a = Math.abs(angle);
  if (a > 135) return 'uturn';
  if (a < 60) return angle < 0 ? 'slightLeft' : 'slightRight';
  return angle < 0 ? 'left' : 'right';
}

const dist = (a: LocalXY, b: LocalXY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function centroid(poly: LocalXY[]): LocalXY {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
}

/** Lado de la puerta según la dirección en que se llega (en el plano, con y hacia abajo). */
export function doorSide(from: LocalXY, door: LocalXY, roomCenter: LocalXY): Side {
  const dir: LocalXY = [door[0] - from[0], door[1] - from[1]];
  const v: LocalXY = [roomCenter[0] - door[0], roomCenter[1] - door[1]];
  const len = Math.hypot(...dir) * Math.hypot(...v);
  if (!len) return 'ahead';
  const cross = (dir[0] * v[1] - dir[1] * v[0]) / len;
  if (Math.abs(cross) < 0.35) return 'ahead';
  return cross > 0 ? 'right' : 'left';
}

/** Pasos de un tramo recorrido en un mismo piso (giros detectados como en exteriores). */
function walkSteps(run: RouteNode[], level: number, first: IndoorStep['kind']): IndoorStep[] {
  const pts = run.map((n) => n.node!.local!.xy);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));

  const turns: { i: number; angle: number }[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    let j = i - 1;
    while (j > 0 && cum[i] - cum[j] < LOOK_M) j--;
    let k = i + 1;
    while (k < pts.length - 1 && cum[k] - cum[i] < LOOK_M) k++;
    const angle = turnAngle(planBearing(pts[j], pts[i]), planBearing(pts[i], pts[k]));
    if (Math.abs(angle) < MIN_TURN_DEG) continue;
    const last = turns.at(-1);
    if (last && cum[i] - cum[last.i] < MERGE_M) {
      if (Math.abs(angle) > Math.abs(last.angle)) turns[turns.length - 1] = { i, angle };
    } else {
      turns.push({ i, angle });
    }
  }

  const cuts = [0, ...turns.map((t) => t.i), pts.length - 1];
  const steps: IndoorStep[] = [];
  for (let c = 0; c < cuts.length - 1; c++) {
    const [a, b] = [cuts[c], cuts[c + 1]];
    const turn = c > 0 ? turns[c - 1] : null;
    steps.push({
      kind: turn ? 'turn' : first,
      level,
      turn: turn ? classify(turn.angle) : undefined,
      distanceM: cum[b] - cum[a],
      landmark: run[a].node?.label,
      path: pts.slice(a, b + 1),
    });
  }
  return steps;
}

/** Tramo interior de la ruta, o null si la ruta no entra a un edificio con plano. */
export function buildIndoorLeg(route: Route, data: CampusData): IndoorLeg | null {
  if (route.indoorFrom >= route.nodes.length) return null;
  const nodes = route.nodes.slice(Math.max(0, route.indoorFrom - 1));
  if (!nodes[0].node?.local) return null;
  const buildingId = nodes[0].node.local.buildingId;

  const steps: IndoorStep[] = [];
  const pathsByLevel = new Map<number, LocalXY[][]>();
  let runStart = 0;
  let firstKind: IndoorStep['kind'] = 'enter';

  const flushRun = (end: number) => {
    const run = nodes.slice(runStart, end + 1);
    const level = run[0].node!.local!.level;
    if (run.length >= 2) {
      steps.push(...walkSteps(run, level, firstKind));
      pathsByLevel.set(level, [...(pathsByLevel.get(level) ?? []), run.map((n) => n.node!.local!.xy)]);
    }
  };

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1].node!.local!;
    const cur = nodes[i].node!.local!;
    if (cur.level === prev.level) continue;
    // Cambio de piso: cerrar el tramo del piso actual y sumar los tramos de escalera seguidos.
    flushRun(i - 1);
    let j = i;
    while (j + 1 < nodes.length && nodes[j + 1].node!.local!.level !== nodes[j].node!.local!.level) j++;
    steps.push({
      kind: nodes[i - 1].node!.kind === 'elevator' ? 'elevator' : 'stairs',
      level: prev.level,
      toLevel: nodes[j].node!.local!.level,
      distanceM: 0,
      landmark: nodes[i - 1].node!.label,
      path: [prev.xy],
    });
    runStart = j;
    firstKind = 'walk';
    i = j;
  }
  flushRun(nodes.length - 1);

  const doorId = nodes.at(-1)!.id;
  const room = data.buildings.find((b) => b.id === buildingId)?.floors.flatMap((f) => f.rooms).find((r) => r.doorNodeId === doorId);
  const door = nodes.at(-1)!.node!.local!;
  const before = nodes.length >= 2 ? nodes.at(-2)!.node!.local!.xy : door.xy;
  steps.push({
    kind: 'arrive',
    level: door.level,
    distanceM: 0,
    side: room && room.polygon.length >= 3 ? doorSide(before, door.xy, centroid(room.polygon)) : 'ahead',
    path: [door.xy],
  });
  return { buildingId, steps, pathsByLevel, room };
}
