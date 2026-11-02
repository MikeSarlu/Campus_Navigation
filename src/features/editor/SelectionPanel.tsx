import type { GraphNode, Localized, Place } from '../../core/data/types';
import styles from './editor.module.css';
import { useEditor } from './editorStore';
import { connect, getNode, recomputeLengths, removeEdge, removeNode } from './ops';

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  path: 'Punto de camino', entrance: 'Entrada', corridor: 'Pasillo', stairs: 'Escalera', elevator: 'Elevador', door: 'Puerta de salón',
};

/** Campo de texto que guarda al salir (un solo paso de deshacer por edición). */
function TextField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  return (
    <label className={styles.row}>
      {label}
      <input
        key={value}
        className={styles.input}
        defaultValue={value}
        onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

function LabelFields({ label, onSave }: { label?: Localized; onSave: (l: Localized | undefined) => void }) {
  const save = (lang: keyof Localized) => (v: string) => {
    const next = { es: label?.es ?? '', en: label?.en ?? '', [lang]: v.trim() };
    onSave(next.es || next.en ? next : undefined);
  };
  return (
    <>
      <p className={styles.hint}>Punto de referencia para las instrucciones (opcional), p. ej. "junto a la cafetería".</p>
      <TextField label="Referencia (es)" value={label?.es ?? ''} onSave={save('es')} />
      <TextField label="Referencia (en)" value={label?.en ?? ''} onSave={save('en')} />
    </>
  );
}

export function SelectionPanel() {
  const selection = useEditor((s) => s.selection);
  if (!selection) return null;
  return (
    <section className={`${styles.section} ${styles.selection}`}>
      {selection.type === 'place' && <PlaceDetails id={selection.id} />}
      {selection.type === 'node' && <NodeDetails id={selection.id} />}
      {selection.type === 'edge' && <EdgeDetails from={selection.from} to={selection.to} />}
      {selection.type === 'room' && <RoomDetails code={selection.code} />}
    </section>
  );
}

function PlaceDetails({ id }: { id: string }) {
  const place = useEditor((s) => s.data?.places.find((p) => p.id === id));
  const commit = useEditor((s) => s.commit);
  const setOutdoorTool = useEditor((s) => s.setOutdoorTool);
  const select = useEditor((s) => s.select);
  if (!place) return null;

  const edit = (fn: (p: Place) => void) => commit((d) => fn(d.places.find((p) => p.id === id)!));

  return (
    <>
      <h2>{place.siglas ? `${place.siglas} · ` : ''}{place.name.es}</h2>
      <TextField label="Nombre (es)" value={place.name.es} onSave={(v) => edit((p) => { p.name.es = v; })} />
      <TextField label="Nombre (en)" value={place.name.en} onSave={(v) => edit((p) => { p.name.en = v; })} />
      <TextField label="Siglas" value={place.siglas ?? ''} onSave={(v) => edit((p) => { p.siglas = v.trim() || undefined; })} />
      <p>
        {place.location ? `Ubicado en ${place.location[1].toFixed(6)}, ${place.location[0].toFixed(6)}` : 'Sin ubicar.'}{' '}
        {place.entranceNodeIds.length} entrada(s).
      </p>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.button} onClick={() => setOutdoorTool('place')}>Ubicar con clic</button>
        <button type="button" className={styles.button} onClick={() => { setOutdoorTool('entrance'); select({ type: 'place', id }); }}>Agregar entrada</button>
        {place.location && <button type="button" className={styles.buttonQuiet} onClick={() => edit((p) => { delete p.location; })}>Quitar ubicación</button>}
        {place.entranceNodeIds.length > 0 && (
          <button type="button" className={styles.buttonQuiet} onClick={() => edit((p) => { p.entranceNodeIds = []; })}>Quitar entradas</button>
        )}
      </div>
    </>
  );
}

function NodeDetails({ id }: { id: string }) {
  const data = useEditor((s) => s.data);
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const node = data?.graph.nodes.find((n) => n.id === id);
  if (!data || !node) return null;

  const places = data.places.filter((p) => p.entranceNodeIds.includes(id));
  const linkedLevels = new Set(
    data.graph.edges
      .filter((e) => e.kind === 'stairs' && (e.from === id || e.to === id))
      .map((e) => getNode(data, e.from === id ? e.to : e.from)?.local?.level),
  );
  // Escaleras/elevadores del mismo edificio en otros pisos, para unirlos.
  const vertical = node.local && (node.kind === 'stairs' || node.kind === 'elevator')
    ? data.graph.nodes.filter((n) => n.kind === node.kind && n.local?.buildingId === node.local!.buildingId && n.local.level !== node.local!.level)
    : [];

  return (
    <>
      <h2>{KIND_LABEL[node.kind]}{node.local ? ` · piso ${node.local.level}` : ''}</h2>
      {places.length > 0 && <p>Entrada de: {places.map((p) => p.name.es).join(', ')}</p>}
      {node.local && (node.kind === 'stairs' || node.kind === 'elevator') && (
        <label className={styles.row}>
          Tipo
          <select value={node.kind} onChange={(e) => commit((d) => { getNode(d, id)!.kind = e.target.value as 'stairs' | 'elevator'; })}>
            <option value="stairs">Escalera</option>
            <option value="elevator">Elevador</option>
          </select>
        </label>
      )}
      {vertical.length > 0 && (
        <div>
          <p className={styles.hint}>Conectar con {node.kind === 'stairs' ? 'la escalera' : 'el elevador'} de otro piso:</p>
          <div className={styles.buttonRow}>
            {vertical.map((n) => {
              const linked = data.graph.edges.some((e) => (e.from === id && e.to === n.id) || (e.to === id && e.from === n.id));
              return (
                <button key={n.id} type="button" className={linked ? styles.buttonQuiet : styles.button}
                  onClick={() => commit((d) => (linked ? removeEdge(d, id, n.id) : connect(d, id, n.id)))}>
                  {linked ? `Desconectar piso ${n.local!.level}` : `Piso ${n.local!.level} (${n.id.slice(-4)})`}
                </button>
              );
            })}
          </div>
          {linkedLevels.size === 0 && <p className={styles.error}>Aún no está conectada a otro piso.</p>}
        </div>
      )}
      <LabelFields label={node.label} onSave={(label) => commit((d) => {
        const n = getNode(d, id)!;
        if (label) n.label = label;
        else delete n.label;
      })} />
      <button type="button" className={styles.buttonDanger} onClick={() => { commit((d) => removeNode(d, id)); select(null); }}>
        Borrar punto
      </button>
    </>
  );
}

function EdgeDetails({ from, to }: { from: string; to: string }) {
  const edge = useEditor((s) => s.data?.graph.edges.find((e) => e.from === from && e.to === to));
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  if (!edge) return null;
  return (
    <>
      <h2>Tramo</h2>
      <p>{edge.lengthM.toFixed(1)} m · {edge.kind}</p>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.buttonQuiet} onClick={() => commit((d) => recomputeLengths(d))}>Recalcular longitudes</button>
        <button type="button" className={styles.buttonDanger} onClick={() => { commit((d) => removeEdge(d, from, to)); select(null); }}>Borrar tramo</button>
      </div>
    </>
  );
}

function RoomDetails({ code }: { code: string }) {
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const room = useEditor((s) => s.data?.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms)).find((r) => r.code === code));
  if (!room) return null;
  return (
    <>
      <h2>Salón {code}</h2>
      <p className={styles.hint}>Para cambiar el código, bórralo y dibújalo de nuevo. Para mover la puerta, arrástrala con Seleccionar.</p>
      <button type="button" className={styles.buttonDanger} onClick={() => { commit((d) => removeNode(d, room.doorNodeId)); select(null); }}>
        Borrar salón
      </button>
    </>
  );
}
