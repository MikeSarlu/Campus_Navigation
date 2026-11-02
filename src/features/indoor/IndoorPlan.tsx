import { useMemo } from 'react';
import { useT } from '../../app/store';
import type { Building, CampusData, LocalXY } from '../../core/data/types';
import type { IndoorLeg } from '../../core/routing/indoor';
import styles from './indoor.module.css';

interface Props {
  data: CampusData;
  building: Building;
  level: number;
  leg: IndoorLeg;
  stepIndex: number;
}

const pts = (p: LocalXY[]) => p.map((xy) => xy.join(',')).join(' ');

function centroid(poly: LocalXY[]): LocalXY {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
}

/**
 * Plano 2D del piso con el rastro de la ruta: lo ya recorrido atenuado, el paso actual
 * resaltado y el resto en azul. Se dibuja en metros y se escala al espacio disponible.
 */
export function IndoorPlan({ data, building, level, leg, stepIndex }: Props) {
  const t = useT();
  const floor = building.floors.find((f) => f.level === level);

  const { corridors, special, viewBox, unit } = useMemo(() => {
    const onFloor = data.graph.nodes.filter((n) => n.local?.buildingId === building.id && n.local.level === level);
    const ids = new Map(onFloor.map((n) => [n.id, n.local!.xy]));
    const corridors = data.graph.edges.filter((e) => e.kind === 'indoor' && ids.has(e.from) && ids.has(e.to)).map((e) => [ids.get(e.from)!, ids.get(e.to)!]);
    const special = onFloor.filter((n) => n.kind === 'stairs' || n.kind === 'elevator' || n.kind === 'entrance');
    const all: LocalXY[] = [...(floor?.outline ?? []), ...(floor?.rooms.flatMap((r) => r.polygon) ?? []), ...onFloor.map((n) => n.local!.xy)];
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = all.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 20, 0, 20];
    const pad = Math.max(2, Math.max(maxX - minX, maxY - minY) * 0.06);
    const size = Math.max(maxX - minX, maxY - minY) + 2 * pad;
    return {
      corridors,
      special,
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`,
      // Unidad para grosores y textos: proporcional al tamaño del piso.
      unit: size / 100,
    };
  }, [data, building.id, level, floor]);

  // Tramos de la ruta en este piso, separados en recorrido / actual / pendiente.
  const segments = leg.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.level === level && s.path.length >= 2);
  const current = leg.steps[stepIndex];
  const here = current.level === level ? current.path[0] : null;
  const destDoor = leg.steps.at(-1)!;
  const destRoom = leg.room;
  const u = unit;

  return (
    <svg className={styles.plan} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('indoor.plan', { floor: level })}>
      {floor && floor.outline.length >= 3 && (
        <polygon points={pts(floor.outline)} fill="#f4f4ef" stroke="#0b0b0b" strokeWidth={u * 0.8} strokeLinejoin="round" />
      )}
      {floor?.rooms.map((r) => {
        const isDest = r.code === destRoom?.code;
        const [x, y] = centroid(r.polygon);
        return (
          <g key={r.code}>
            <polygon points={pts(r.polygon)} fill={isDest ? '#c8102e' : '#ffffff'} fillOpacity={isDest ? 0.85 : 1}
              stroke="#4d4d49" strokeWidth={u * 0.4} />
            <text x={x} y={y} fontSize={u * 3.6} fontWeight="700" textAnchor="middle" dominantBaseline="middle"
              fill={isDest ? '#ffffff' : '#0b0b0b'} className={styles.label}>{r.code}</text>
          </g>
        );
      })}
      {corridors.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#c9c9c3" strokeWidth={u * 1.6} strokeLinecap="round" />
      ))}

      {segments.map(({ s, i }) => {
        const done = i < stepIndex;
        const active = i === stepIndex;
        return (
          <g key={i}>
            {active && <polyline points={pts(s.path)} fill="none" stroke="#ffffff" strokeWidth={u * 3.4} strokeLinecap="round" strokeLinejoin="round" />}
            <polyline points={pts(s.path)} fill="none" stroke={done ? '#9aa6c4' : '#0040c1'} strokeWidth={u * (active ? 2.4 : 1.6)}
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray={done ? `${u * 1.5} ${u * 1.5}` : undefined} />
          </g>
        );
      })}

      {special.map((n) => (
        <g key={n.id} transform={`translate(${n.local!.xy[0]} ${n.local!.xy[1]})`}>
          <rect x={-u * 2.2} y={-u * 2.2} width={u * 4.4} height={u * 4.4} rx={u * 0.8}
            fill={n.kind === 'entrance' ? '#0a7a2f' : '#7a2fd0'} stroke="#fff" strokeWidth={u * 0.5} />
          {/* Símbolo dibujado en una caja de 24 unidades: escalones, flechas de elevador o puerta. */}
          <path transform={`scale(${(u * 3.4) / 24}) translate(-12 -12)`} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
            d={n.kind === 'stairs' ? 'M4 20h5v-5h5v-5h5V5' : n.kind === 'elevator' ? 'M8 10l4-5 4 5M8 14l4 5 4-5' : 'M6 4h9v16H6zM11 12h9M17 9l3 3-3 3'} />
        </g>
      ))}

      {destDoor.level === level && (
        <circle cx={destDoor.path[0][0]} cy={destDoor.path[0][1]} r={u * 2.2} fill="#c8102e" stroke="#fff" strokeWidth={u * 0.7} />
      )}
      {here && <circle cx={here[0]} cy={here[1]} r={u * 2.2} fill="#1a73e8" stroke="#fff" strokeWidth={u * 0.8} />}
    </svg>
  );
}
