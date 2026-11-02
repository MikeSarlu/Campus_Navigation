import { useMemo, useState } from 'react';
import styles from '../editor.module.css';
import { useEditor, type OutdoorTool } from '../editorStore';
import { AnchorSection } from '../indoor/IndoorPanel';
import type { GpsState } from '../useGpsAverager';
import type { Basemap } from './OutdoorEditor';
import { importOsmPaths } from './osmImport';
import { addEntrance, addPathPoint, setAnchorWorld, setPlaceLocation } from './outdoorActions';

const TOOLS: { id: OutdoorTool; label: string; hint: string }[] = [
  { id: 'select', label: 'Seleccionar', hint: 'Toca un punto, tramo o lugar para editarlo. Arrastra puntos para moverlos.' },
  { id: 'path', label: 'Camino', hint: 'Toca para agregar puntos unidos. Tocar un punto o tramo existente los conecta. Toca el último punto para terminar.' },
  { id: 'place', label: 'Ubicar lugar', hint: 'Elige un lugar de la lista y toca el mapa donde está su marcador.' },
  { id: 'entrance', label: 'Entrada', hint: 'Elige un lugar y toca su puerta, o un punto de camino existente.' },
  { id: 'anchor', label: 'Anclar plano', hint: 'Toca en el mapa dónde está el punto de referencia que marcaste en el plano.' },
  { id: 'delete', label: 'Borrar', hint: 'Toca un punto o tramo para borrarlo.' },
];

interface Props {
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  gps: { state: GpsState; start: () => void; stop: () => void; reset: () => void };
}

export function OutdoorPanel({ basemap, onBasemap, gps }: Props) {
  const tool = useEditor((s) => s.outdoorTool);
  const setTool = useEditor((s) => s.setOutdoorTool);
  const chainFrom = useEditor((s) => s.chainFrom);
  const set = useEditor((s) => s.set);
  const hint = TOOLS.find((t) => t.id === tool)!.hint;

  return (
    <>
      <section className={styles.section}>
        <h2>Herramienta</h2>
        <div className={styles.toolGrid}>
          {TOOLS.map((t) => (
            <button key={t.id} type="button" className={styles.tool} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className={styles.hint}>{hint}</p>
        {chainFrom && (
          <button type="button" className={styles.button} onClick={() => set({ chainFrom: null })}>
            Terminar camino
          </button>
        )}
        <label className={styles.row}>
          Fondo
          <select value={basemap} onChange={(e) => onBasemap(e.target.value as Basemap)}>
            <option value="osm">Mapa (OpenStreetMap)</option>
            <option value="satellite">Satélite (Esri)</option>
          </select>
        </label>
      </section>
      {tool === 'anchor' && <AnchorSection />}
      <GpsSection gps={gps} />
      <PlacesList />
      <OsmImportSection />
    </>
  );
}

function OsmImportSection() {
  const commit = useEditor((s) => s.commit);
  const hasPaths = useEditor((s) => s.data?.graph.nodes.some((n) => n.kind === 'path') ?? false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async () => {
    if (hasPaths && !confirm('Ya hay caminos dibujados. Importar agrega los de OpenStreetMap encima y puede duplicarlos. ¿Continuar?')) return;
    setStatus('Importando…');
    try {
      const { nodes, edges } = await importOsmPaths(commit);
      setStatus(`Se agregaron ${nodes} puntos y ${edges} tramos. Revísalos: puedes deshacer con Ctrl+Z.`);
    } catch (e) {
      setStatus(`No se pudo importar: ${(e as Error).message}`);
    }
  };

  return (
    <section className={styles.section}>
      <h2>Caminos de OpenStreetMap</h2>
      <p className={styles.hint}>
        Agrega como punto de partida los caminos y calles que OpenStreetMap ya tiene dentro del campus. Después corrige lo que falte o sobre.
      </p>
      <button type="button" className={styles.button} onClick={() => void run()}>Importar caminos del campus</button>
      {status && <p aria-live="polite">{status}</p>}
    </section>
  );
}

function GpsSection({ gps }: Pick<Props, 'gps'>) {
  const { state, start, stop, reset } = gps;
  const selection = useEditor((s) => s.selection);
  const canAnchor = useEditor((s) => !!s.buildingId && (!!s.pendingRef || !!s.data?.buildings.find((b) => b.id === s.buildingId)?.anchor));
  const placeSelected = selection?.type === 'place';
  const pos = state.estimate?.pos;

  const done = (ok: boolean) => ok && reset();

  return (
    <section className={styles.section}>
      <h2>Marcar con GPS</h2>
      <p className={styles.hint}>Quédate quieto en el punto. Mientras más lecturas, mejor precisión.</p>
      {!state.running && !pos && (
        <button type="button" className={styles.button} onClick={start}>Empezar a medir</button>
      )}
      {state.error && <p className={styles.error}>{state.error}</p>}
      {(state.running || pos) && (
        <p className={styles.gpsReadout} aria-live="polite">
          {state.samples} lecturas{state.rejected ? ` (${state.rejected} descartadas)` : ''}
          {state.estimate && <> · <strong>±{state.estimate.accuracyM.toFixed(1)} m</strong></>}
        </p>
      )}
      {state.running && <button type="button" className={styles.button} onClick={stop}>Detener</button>}
      {pos && (
        <div className={styles.buttonRow}>
          <button type="button" className={styles.button} onClick={() => { addPathPoint(pos, null); reset(); }}>Punto de camino</button>
          {placeSelected && <button type="button" className={styles.button} onClick={() => done(setPlaceLocation(pos))}>Ubicar lugar</button>}
          {placeSelected && <button type="button" className={styles.button} onClick={() => done(addEntrance(pos, null))}>Entrada del lugar</button>}
          {canAnchor && <button type="button" className={styles.button} onClick={() => done(setAnchorWorld(pos))}>Anclar plano</button>}
          <button type="button" className={styles.buttonQuiet} onClick={reset}>Descartar</button>
        </div>
      )}
    </section>
  );
}

function PlacesList() {
  const places = useEditor((s) => s.data?.places ?? []);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const [filter, setFilter] = useState('');

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? places.filter((p) => `${p.siglas ?? ''} ${p.name.es}`.toLowerCase().includes(q)) : places;
  }, [places, filter]);
  const located = places.filter((p) => p.location).length;

  return (
    <section className={styles.section}>
      <h2>Lugares <span className={styles.count}>{located}/{places.length} ubicados</span></h2>
      <input className={styles.input} type="search" placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ul className={styles.placeList}>
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={selection?.type === 'place' && selection.id === p.id}
              onClick={() => select({ type: 'place', id: p.id })}
            >
              <span className={styles.siglas}>{p.siglas ?? '—'}</span>
              <span>{p.name.es}</span>
              <span className={p.location ? styles.ok : styles.missing}>
                {p.location ? `ubicado · ${p.entranceNodeIds.length} ent.` : 'sin ubicar'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
