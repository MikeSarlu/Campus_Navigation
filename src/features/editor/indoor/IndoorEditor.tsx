import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { GraphNode, LocalXY } from '../../../core/data/types';
import { distanceXY, pointInPolygon, pointToSegment } from '../../../core/geo';
import styles from '../editor.module.css';
import { bgKey, useEditor } from '../editorStore';
import { moveNode } from '../ops';
import { addCorridorPoint, addSpecialNode, closePolygon, deletePlanHit, placeDoor, type PlanHit } from './indoorActions';

interface View {
  cx: number; // centro, en metros
  cy: number;
  scale: number; // píxeles por metro
}

const HIT_PX = 14;
const NODE_COLORS: Record<GraphNode['kind'], string> = {
  corridor: '#0040c1', path: '#0040c1', door: '#b00e28', stairs: '#732cc4', elevator: '#732cc4', entrance: '#086627',
};

function centroid(poly: LocalXY[]): LocalXY {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

export function IndoorEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ cx: 25, cy: 20, scale: 12 });
  const [drag, setDrag] = useState<{ id: string; xy: LocalXY } | null>(null);
  const pan = useRef<{ x: number; y: number; view: View } | null>(null);

  const data = useEditor((s) => s.data);
  const buildingId = useEditor((s) => s.buildingId);
  const level = useEditor((s) => s.level);
  const tool = useEditor((s) => s.indoorTool);
  const selection = useEditor((s) => s.selection);
  const chainFrom = useEditor((s) => s.chainFrom);
  const draft = useEditor((s) => s.draft);
  const pendingRoom = useEditor((s) => s.pendingRoom);
  const pendingRef = useEditor((s) => s.pendingRef);
  const bg = useEditor((s) => (buildingId && level !== null ? s.backgrounds[bgKey(buildingId, level)] : undefined));

  const building = data?.buildings.find((b) => b.id === buildingId);
  const floor = building?.floors.find((f) => f.level === level);

  const { nodes, edges } = useMemo(() => {
    const onFloor = (n: GraphNode) => n.local?.buildingId === buildingId && n.local.level === level;
    const nodes = (data?.graph.nodes ?? []).filter(onFloor);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (data?.graph.edges ?? []).filter((e) => e.kind === 'indoor' && ids.has(e.from) && ids.has(e.to));
    return { nodes, edges };
  }, [data, buildingId, level]);

  const posOf = (n: GraphNode): LocalXY => (drag?.id === n.id ? drag.xy : n.local!.xy);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!floor]);

  // Encuadrar el piso al cambiar de edificio o piso.
  useEffect(() => {
    const pts: LocalXY[] = [...(floor?.outline ?? []), ...nodes.map((n) => n.local!.xy)];
    if (bg) pts.push(bg.offset, [bg.offset[0] + bg.widthPx * bg.mPerPx, bg.offset[1] + bg.heightPx * bg.mPerPx]);
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) || 20;
    const h = Math.max(...ys) - Math.min(...ys) || 20;
    setView({
      cx: (Math.max(...xs) + Math.min(...xs)) / 2,
      cy: (Math.max(...ys) + Math.min(...ys)) / 2,
      scale: Math.min(size.w / (w * 1.15), size.h / (h * 1.15)),
    });
    // Solo al cambiar de piso, no en cada edición.
  }, [buildingId, level, !!bg]);

  const vb = { x: view.cx - size.w / view.scale / 2, y: view.cy - size.h / view.scale / 2, w: size.w / view.scale, h: size.h / view.scale };

  function toLocal(e: { clientX: number; clientY: number }): LocalXY {
    const r = svgRef.current!.getBoundingClientRect();
    return [vb.x + (e.clientX - r.left) / view.scale, vb.y + (e.clientY - r.top) / view.scale];
  }

  function hitTest(p: LocalXY, allowRoom: boolean): PlanHit {
    const tol = HIT_PX / view.scale;
    const node = nodes
      .map((n) => ({ n, d: distanceXY(n.local!.xy, p) }))
      .filter((x) => x.d <= tol)
      .sort((a, b) => a.d - b.d)[0];
    if (node) return { node: node.n.id };
    const edge = edges.find((e) => pointToSegment(p, byId.get(e.from)!.local!.xy, byId.get(e.to)!.local!.xy).dist <= tol);
    if (edge) return { edge: [edge.from, edge.to] };
    if (allowRoom) {
      const room = floor?.rooms.find((r) => pointInPolygon(p, r.polygon));
      if (room) return { room: room.code };
    }
    return null;
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (!floor) return;
    const p = toLocal(e);
    const s = useEditor.getState();
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      pan.current = { x: e.clientX, y: e.clientY, view };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const graphHit = hitTest(p, false);
    switch (tool) {
      case 'select': {
        const hit = hitTest(p, true);
        if (hit && 'node' in hit) {
          s.select({ type: 'node', id: hit.node });
          setDrag({ id: hit.node, xy: byId.get(hit.node)!.local!.xy });
        } else if (hit && 'edge' in hit) s.select({ type: 'edge', from: hit.edge[0], to: hit.edge[1] });
        else if (hit && 'room' in hit) s.select({ type: 'room', code: hit.room });
        else {
          s.select(null);
          pan.current = { x: e.clientX, y: e.clientY, view };
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        break;
      }
      case 'corridor':
        addCorridorPoint(p, graphHit);
        break;
      case 'outline':
      case 'room': {
        if (s.pendingRoom) break;
        const closes = s.draft.length >= 3 && distanceXY(s.draft[0], p) <= HIT_PX / view.scale;
        if (closes) closePolygon(tool);
        else s.set({ draft: [...s.draft, p] });
        break;
      }
      case 'door':
        placeDoor(p, graphHit && 'edge' in graphHit ? graphHit : null);
        break;
      case 'stairs':
      case 'entrance':
        addSpecialNode(tool, p, graphHit && 'edge' in graphHit ? graphHit : null);
        break;
      case 'calibrate':
        s.set({ draft: s.draft.length >= 2 ? [p] : [...s.draft, p] });
        break;
      case 'ref':
        s.set({ pendingRef: p });
        break;
      case 'delete':
        deletePlanHit(hitTest(p, true));
        break;
    }
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (pan.current) {
      const { x, y, view: v } = pan.current;
      setView({ ...v, cx: v.cx - (e.clientX - x) / v.scale, cy: v.cy - (e.clientY - y) / v.scale });
    } else if (drag) {
      setDrag({ id: drag.id, xy: toLocal(e) });
    }
  }

  function onPointerUp() {
    pan.current = null;
    if (drag) {
      const { id, xy } = drag;
      const original = byId.get(id)?.local?.xy;
      setDrag(null);
      if (original && distanceXY(original, xy) > 0.05) useEditor.getState().commit((d) => moveNode(d, id, { xy }));
    }
  }

  function onWheel(e: WheelEvent<SVGSVGElement>) {
    const p = toLocal(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const scale = Math.min(200, Math.max(1, view.scale * factor));
    // Zoom alrededor del cursor.
    setView({ scale, cx: p[0] + (view.cx - p[0]) * (view.scale / scale), cy: p[1] + (view.cy - p[1]) * (view.scale / scale) });
  }

  const zoom = (f: number) => setView((v) => ({ ...v, scale: Math.min(200, Math.max(1, v.scale * f)) }));
  const px = (n: number) => n / view.scale; // tamaño en pantalla → metros

  if (!building || !floor) {
    return <div className={styles.canvasEmpty}>Elige o agrega un edificio y un piso en el panel.</div>;
  }

  const anchorRef = pendingRef ?? building.anchor?.refLocal;

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        className={styles.plan}
        data-tool={tool}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0H0V1" fill="none" stroke="#d0d4cc" strokeWidth={px(1)} />
          </pattern>
          <pattern id="grid5" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="url(#grid)" />
            <path d="M5 0H0V5" fill="none" stroke="#a9aea3" strokeWidth={px(1)} />
          </pattern>
        </defs>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={view.scale > 6 ? 'url(#grid5)' : '#f4f5f2'} />

        {bg && (
          <image href={bg.url} x={bg.offset[0]} y={bg.offset[1]} width={bg.widthPx * bg.mPerPx} height={bg.heightPx * bg.mPerPx}
            opacity={bg.opacity} preserveAspectRatio="none" />
        )}

        {floor.outline.length >= 3 && (
          <polygon points={floor.outline.join(' ')} fill="rgb(255 255 255 / 0.35)" stroke="#0b0b0b" strokeWidth={px(3)} />
        )}

        {floor.rooms.map((r) => {
          const selected = selection?.type === 'room' && selection.code === r.code;
          const [x, y] = centroid(r.polygon);
          return (
            <g key={r.code}>
              <polygon points={r.polygon.join(' ')} fill={selected ? 'rgb(255 106 0 / 0.3)' : 'rgb(0 64 193 / 0.12)'}
                stroke={selected ? '#ff6a00' : '#0040c1'} strokeWidth={px(2)} />
              <text x={x} y={y} fontSize={px(13)} fontWeight="700" textAnchor="middle" dominantBaseline="middle" className={styles.planLabel}>
                {r.code}
              </text>
            </g>
          );
        })}

        {edges.map((e) => {
          const a = posOf(byId.get(e.from)!);
          const b = posOf(byId.get(e.to)!);
          const selected = selection?.type === 'edge' && selection.from === e.from && selection.to === e.to;
          return <line key={`${e.from}-${e.to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={selected ? '#ff6a00' : '#0040c1'} strokeWidth={px(selected ? 6 : 4)} strokeLinecap="round" />;
        })}

        {nodes.map((n) => {
          const [x, y] = posOf(n);
          const selected = (selection?.type === 'node' && selection.id === n.id) || chainFrom === n.id;
          const r = px(n.kind === 'corridor' ? 5 : 8);
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={selected ? r * 1.5 : r} fill={selected ? '#ff6a00' : NODE_COLORS[n.kind]} stroke="#fff" strokeWidth={px(2)} />
              {(n.kind === 'stairs' || n.kind === 'elevator' || n.kind === 'entrance') && (
                <text x={x} y={y - px(14)} fontSize={px(12)} fontWeight="700" textAnchor="middle" className={styles.planLabel}>
                  {n.kind === 'stairs' ? 'Escalera' : n.kind === 'elevator' ? 'Elevador' : 'Entrada'}
                </text>
              )}
            </g>
          );
        })}

        {pendingRoom && <polygon points={pendingRoom.join(' ')} fill="rgb(255 106 0 / 0.2)" stroke="#ff6a00" strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(4)}`} />}
        {draft.length > 0 && (
          <g>
            <polyline points={draft.join(' ')} fill={tool === 'door' ? 'rgb(255 106 0 / 0.2)' : 'none'} stroke="#ff6a00" strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(4)}`} />
            {draft.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={px(i === 0 ? 7 : 4)} fill="#ff6a00" />)}
          </g>
        )}

        {anchorRef && (
          <g stroke="#732cc4" strokeWidth={px(3)}>
            <line x1={anchorRef[0] - px(12)} y1={anchorRef[1]} x2={anchorRef[0] + px(12)} y2={anchorRef[1]} />
            <line x1={anchorRef[0]} y1={anchorRef[1] - px(12)} x2={anchorRef[0]} y2={anchorRef[1] + px(12)} />
          </g>
        )}
      </svg>
      <div className={styles.zoom}>
        <button type="button" onClick={() => zoom(1.4)} aria-label="Acercar">+</button>
        <button type="button" onClick={() => zoom(1 / 1.4)} aria-label="Alejar">−</button>
      </div>
    </div>
  );
}
