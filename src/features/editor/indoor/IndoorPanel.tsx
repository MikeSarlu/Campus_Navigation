import { useEffect, useState } from 'react';
import { recomputeLengths, removeNode } from '../ops';
import { distanceXY } from '../../../core/geo';
import styles from '../editor.module.css';
import { bgKey, useEditor, type IndoorTool } from '../editorStore';
import { removeBackground, saveBackground, updateBackground } from '../persistence';
import { closePolygon, roomCodeError, saveRoom } from './indoorActions';

const TOOLS: { id: Exclude<IndoorTool, 'door'>; label: string; hint: string }[] = [
  { id: 'select', label: 'Seleccionar', hint: 'Toca para editar; arrastra puntos para moverlos; arrastra el fondo para desplazarte. Rueda del ratón: zoom.' },
  { id: 'corridor', label: 'Pasillo', hint: 'Toca para trazar el pasillo por su centro. Tocar un punto o tramo existente los une. Toca el último punto para terminar.' },
  { id: 'outline', label: 'Contorno', hint: 'Toca las esquinas del piso. Toca el primer punto para cerrar.' },
  { id: 'room', label: 'Salón', hint: 'Toca las esquinas del salón y cierra en el primer punto. Luego escribe su código y toca dónde está la puerta.' },
  { id: 'stairs', label: 'Escalera', hint: 'Toca sobre un pasillo para poner una escalera. Después, en el panel, conéctala con la del otro piso.' },
  { id: 'entrance', label: 'Entrada', hint: 'Toca sobre un pasillo donde está una puerta exterior del edificio.' },
  { id: 'calibrate', label: 'Calibrar', hint: 'Toca dos puntos del fondo cuya distancia real conozcas (p. ej. un muro medido).' },
  { id: 'ref', label: 'Referencia', hint: 'Toca un punto fácil de reconocer en el mapa (p. ej. la entrada principal). Después ubícalo en el mapa.' },
  { id: 'delete', label: 'Borrar', hint: 'Toca un punto, tramo o salón para borrarlo.' },
];

export function IndoorPanel() {
  const tool = useEditor((s) => s.indoorTool);
  const setTool = useEditor((s) => s.setIndoorTool);
  const pendingDoorFor = useEditor((s) => s.pendingDoorFor);
  const hint = TOOLS.find((t) => t.id === tool)?.hint;

  return (
    <>
      <FloorPicker />
      <section className={styles.section}>
        <h2>Herramienta</h2>
        <div className={styles.toolGrid}>
          {TOOLS.map((t) => (
            <button key={t.id} type="button" className={styles.tool} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {pendingDoorFor ? (
          <p className={styles.callout}>Toca dónde está la puerta de <strong>{pendingDoorFor}</strong> (de preferencia sobre el pasillo).</p>
        ) : (
          <p className={styles.hint}>{hint}</p>
        )}
        <DrawingControls />
        <RoomCodeForm />
        <Calibration />
      </section>
      <BackgroundSection />
      <AnchorSection />
    </>
  );
}

function FloorPicker() {
  const data = useEditor((s) => s.data);
  const buildingId = useEditor((s) => s.buildingId);
  const level = useEditor((s) => s.level);
  const setFloor = useEditor((s) => s.setFloor);
  const commit = useEditor((s) => s.commit);
  if (!data) return null;

  const building = data.buildings.find((b) => b.id === buildingId);
  const candidates = data.places.filter((p) => p.kind === 'building' && p.siglas && !p.buildingId);

  const addBuilding = (placeId: string) => {
    const place = data.places.find((p) => p.id === placeId);
    if (!place?.siglas) return;
    const id = `bld-${place.id}`;
    commit((d) => {
      d.buildings.push({ id, siglas: place.siglas!, floors: [] });
      d.places.find((p) => p.id === placeId)!.buildingId = id;
    });
    setFloor(id, null);
  };

  const addFloor = () => {
    if (!building) return;
    const next = building.floors.length ? Math.max(...building.floors.map((f) => f.level)) + 1 : 1;
    commit((d) => {
      const b = d.buildings.find((x) => x.id === building.id)!;
      b.floors.push({ level: next, outline: [], rooms: [] });
      b.floors.sort((x, y) => x.level - y.level);
    });
    setFloor(building.id, next);
  };

  const deleteFloor = () => {
    if (!building || level === null) return;
    if (!confirm(`¿Borrar el piso ${level} de ${building.siglas} con todos sus salones y pasillos?`)) return;
    commit((d) => {
      const b = d.buildings.find((x) => x.id === building.id)!;
      for (const n of d.graph.nodes.filter((n) => n.local?.buildingId === b.id && n.local.level === level)) removeNode(d, n.id);
      b.floors = b.floors.filter((f) => f.level !== level);
    });
    setFloor(building.id, building.floors.find((f) => f.level !== level)?.level ?? null);
  };

  return (
    <section className={styles.section}>
      <h2>Edificio y piso</h2>
      <label className={styles.row}>
        Edificio
        <select value={buildingId ?? ''} onChange={(e) => {
          const b = data.buildings.find((x) => x.id === e.target.value);
          setFloor(b?.id ?? null, b?.floors[0]?.level ?? null);
        }}>
          {!building && <option value="">—</option>}
          {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.siglas}</option>)}
        </select>
      </label>
      <label className={styles.row}>
        Agregar edificio
        <select value="" onChange={(e) => e.target.value && addBuilding(e.target.value)}>
          <option value="">Elegir…</option>
          {candidates.map((p) => <option key={p.id} value={p.id}>{p.siglas} · {p.name.es}</option>)}
        </select>
      </label>
      {building && (
        <div className={styles.buttonRow} role="group" aria-label="Pisos">
          {building.floors.map((f) => (
            <button key={f.level} type="button" className={styles.tool} aria-pressed={f.level === level} onClick={() => setFloor(building.id, f.level)}>
              Piso {f.level}
            </button>
          ))}
          <button type="button" className={styles.buttonQuiet} onClick={addFloor}>+ Piso</button>
          {level !== null && <button type="button" className={styles.buttonQuiet} onClick={deleteFloor}>Borrar piso</button>}
        </div>
      )}
    </section>
  );
}

function DrawingControls() {
  const tool = useEditor((s) => s.indoorTool);
  const draft = useEditor((s) => s.draft);
  const chainFrom = useEditor((s) => s.chainFrom);
  const pendingRoom = useEditor((s) => s.pendingRoom);
  const set = useEditor((s) => s.set);

  if (chainFrom) {
    return <button type="button" className={styles.button} onClick={() => set({ chainFrom: null })}>Terminar pasillo</button>;
  }
  if ((tool === 'outline' || tool === 'room') && draft.length && !pendingRoom) {
    return (
      <div className={styles.buttonRow}>
        {draft.length >= 3 && <button type="button" className={styles.button} onClick={() => closePolygon(tool)}>Cerrar polígono</button>}
        <button type="button" className={styles.buttonQuiet} onClick={() => set({ draft: draft.slice(0, -1) })}>Quitar último punto</button>
        <button type="button" className={styles.buttonQuiet} onClick={() => set({ draft: [] })}>Cancelar</button>
      </div>
    );
  }
  return null;
}

function RoomCodeForm() {
  const pendingRoom = useEditor((s) => s.pendingRoom);
  const building = useEditor((s) => s.data?.buildings.find((b) => b.id === s.buildingId));
  const level = useEditor((s) => s.level);
  const set = useEditor((s) => s.set);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (pendingRoom && building) setCode(`${building.siglas}-${level}`);
  }, [pendingRoom, building, level]);

  if (!pendingRoom) return null;
  const error = roomCodeError(code);

  return (
    <form className={styles.callout} onSubmit={(e) => { e.preventDefault(); if (!error) saveRoom(code); }}>
      <label className={styles.row}>
        Código del salón
        <input className={styles.input} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.buttonRow}>
        <button type="submit" className={styles.button} disabled={!!error}>Guardar y poner puerta</button>
        <button type="button" className={styles.buttonQuiet} onClick={() => set({ pendingRoom: null })}>Cancelar</button>
      </div>
    </form>
  );
}

function Calibration() {
  const tool = useEditor((s) => s.indoorTool);
  const draft = useEditor((s) => s.draft);
  const key = useEditor((s) => (s.buildingId && s.level !== null ? bgKey(s.buildingId, s.level) : null));
  const bg = useEditor((s) => (key ? s.backgrounds[key] : undefined));
  const set = useEditor((s) => s.set);
  const [real, setReal] = useState('');

  if (tool !== 'calibrate') return null;
  if (!bg || !key) return <p className={styles.error}>Primero sube un fondo para este piso.</p>;
  if (draft.length < 2) return <p className={styles.hint}>Escala actual: {(bg.mPerPx * 100).toFixed(2)} cm por píxel.</p>;

  const measured = distanceXY(draft[0], draft[1]);
  const realM = Number(real.replace(',', '.'));
  const apply = () => {
    void updateBackground(key, { mPerPx: (bg.mPerPx * realM) / measured });
    set({ draft: [] });
    setReal('');
  };

  return (
    <form className={styles.callout} onSubmit={(e) => { e.preventDefault(); if (realM > 0) apply(); }}>
      <p>En el plano mide {measured.toFixed(2)} m con la escala actual.</p>
      <label className={styles.row}>
        Distancia real (m)
        <input className={styles.input} inputMode="decimal" autoFocus value={real} onChange={(e) => setReal(e.target.value)} />
      </label>
      <p className={styles.hint}>Calibra antes de dibujar: lo ya dibujado no se reescala.</p>
      <button type="submit" className={styles.button} disabled={!(realM > 0)}>Aplicar escala</button>
    </form>
  );
}

function BackgroundSection() {
  const key = useEditor((s) => (s.buildingId && s.level !== null ? bgKey(s.buildingId, s.level) : null));
  const bg = useEditor((s) => (key ? s.backgrounds[key] : undefined));
  if (!key) return null;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      void saveBackground(key, file, { widthPx: img.naturalWidth, heightPx: img.naturalHeight, mPerPx: 0.05, offset: [0, 0], opacity: 0.6 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <section className={styles.section}>
      <h2>Fondo del piso</h2>
      <p className={styles.hint}>Foto o croquis para calcar encima. Se guarda solo en este navegador, no en campus.json.</p>
      <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
      {bg && (
        <>
          <label className={styles.row}>
            Opacidad
            <input type="range" min="0.1" max="1" step="0.05" value={bg.opacity}
              onChange={(e) => void updateBackground(key, { opacity: Number(e.target.value) })} />
          </label>
          <button type="button" className={styles.buttonQuiet} onClick={() => void removeBackground(key)}>Quitar fondo</button>
        </>
      )}
    </section>
  );
}

export function AnchorSection() {
  const building = useEditor((s) => s.data?.buildings.find((b) => b.id === s.buildingId));
  const pendingRef = useEditor((s) => s.pendingRef);
  const commit = useEditor((s) => s.commit);
  const setMode = useEditor((s) => s.setMode);
  const setOutdoorTool = useEditor((s) => s.setOutdoorTool);
  const [rotation, setRotation] = useState(0);

  useEffect(() => setRotation(building?.anchor?.rotationDeg ?? 0), [building?.anchor?.rotationDeg]);
  if (!building) return null;

  const anchor = building.anchor;
  const commitRotation = (deg: number) => {
    if (!anchor || deg === anchor.rotationDeg) return;
    commit((d) => {
      d.buildings.find((b) => b.id === building.id)!.anchor!.rotationDeg = deg;
      recomputeLengths(d);
    });
  };

  return (
    <section className={styles.section}>
      <h2>Ubicación en el mapa</h2>
      <p className={styles.hint}>
        {anchor ? 'Plano anclado. Revisa en el mapa exterior que el contorno coincida con el edificio.' : 'Sin anclar: las entradas no se pueden unir a los caminos exteriores.'}
      </p>
      {(pendingRef || anchor) && (
        <button type="button" className={styles.button} onClick={() => { setMode('outdoor'); setOutdoorTool('anchor'); }}>
          {pendingRef ? 'Ubicar la referencia en el mapa' : 'Mover la referencia en el mapa'}
        </button>
      )}
      {anchor && (
        <label className={styles.row}>
          Rotación ({rotation.toFixed(1)}°)
          <input type="range" min="-180" max="180" step="0.5" value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            onPointerUp={() => commitRotation(rotation)}
            onKeyUp={() => commitRotation(rotation)} />
        </label>
      )}
    </section>
  );
}
