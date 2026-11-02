// Vista 3D "explotada": los pisos del edificio apilados y separados, con la ruta subiendo
// por las escaleras. Se genera con los mismos datos del editor; no hay un modelo aparte.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Building, CampusData, LocalXY } from '../../core/data/types';
import type { IndoorLeg } from '../../core/routing/indoor';
import styles from './indoor.module.css';

interface Props {
  data: CampusData;
  building: Building;
  leg: IndoorLeg;
  stepIndex: number;
  label: string;
  /** Etiqueta de piso ya traducida, con "#" en lugar del número ("Piso #"). */
  floorLabel: string;
}

/** Separación vertical entre pisos en la vista explotada (m). Mayor que la real para ver cada piso. */
const FLOOR_GAP = 7;

function floorOutline(data: CampusData, building: Building, level: number): LocalXY[] {
  const floor = building.floors.find((f) => f.level === level);
  if (floor && floor.outline.length >= 3) return floor.outline;
  // Sin contorno dibujado: rectángulo que envuelve salones y pasillos.
  const pts = [
    ...(floor?.rooms.flatMap((r) => r.polygon) ?? []),
    ...data.graph.nodes.filter((n) => n.local?.buildingId === building.id && n.local.level === level).map((n) => n.local!.xy),
  ];
  if (!pts.length) return [];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 2, Math.max(...xs) + 2, Math.min(...ys) - 2, Math.max(...ys) + 2];
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** Texto como sprite (etiquetas de piso). */
function textSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, 128, 48);
  ctx.fillStyle = '#0b0b0b';
  ctx.fillText(text, 128, 48);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
  // Se dibuja al final para que las losas semitransparentes no la tapen.
  sprite.renderOrder = 10;
  sprite.scale.set(11, 4.1, 1);
  return sprite;
}

export function Indoor3D({ data, building, leg, stepIndex, label, floorLabel }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const levels = [...building.floors].map((f) => f.level).sort((a, b) => a - b);
    const height = (level: number) => levels.indexOf(level) * FLOOR_GAP;
    // Plano (x, y hacia abajo) → mundo 3D (x, altura, z).
    const v3 = (xy: LocalXY, level: number, lift = 0) => new THREE.Vector3(xy[0], height(level) + lift, xy[1]);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    scene.add(new THREE.HemisphereLight('#ffffff', '#b0b0a8', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.2);
    sun.position.set(30, 60, 20);
    scene.add(sun);

    const box = new THREE.Box3();
    for (const level of levels) {
      const outline = floorOutline(data, building, level);
      if (outline.length < 3) continue;
      const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, -y)));
      const slab = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false });
      slab.rotateX(-Math.PI / 2);
      slab.translate(0, height(level), 0);
      const onRoute = leg.steps.some((s) => s.level === level);
      scene.add(new THREE.Mesh(slab, new THREE.MeshStandardMaterial({ color: onRoute ? '#e9ecf5' : '#f1f1ec', transparent: true, opacity: 0.85 })));
      scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab), new THREE.LineBasicMaterial({ color: '#4d4d49' })));
      box.expandByObject(scene.children.at(-1)!);

      const tag = textSprite(floorLabel.replace('#', String(level)));
      // Esquina frontal izquierda (la más cercana a la cámara), para que la etiqueta se vea.
      const corner = outline.reduce((a, b) => (b[0] - b[1] < a[0] - a[1] ? b : a));
      tag.position.copy(v3(corner, level, 1.8)).add(new THREE.Vector3(1, 0, -1));
      scene.add(tag);

      for (const room of building.floors.find((f) => f.level === level)?.rooms ?? []) {
        const isDest = room.code === leg.room?.code;
        const ring = room.polygon.map((p) => v3(p, level, 0.45));
        if (isDest) {
          const geo = new THREE.ExtrudeGeometry(new THREE.Shape(room.polygon.map(([x, y]) => new THREE.Vector2(x, -y))), { depth: 2.2, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          geo.translate(0, height(level) + 0.4, 0);
          scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#b00e28', transparent: true, opacity: 0.8 })));
        }
        scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: isDest ? '#b00e28' : '#8c8c86' })));
      }
    }

    // Ruta: tramos de cada piso y subidas por la escalera, como un tubo azul continuo.
    const routePts: THREE.Vector3[] = [];
    for (const s of leg.steps) {
      for (const p of s.path) routePts.push(v3(p, s.level, 0.9));
      if ((s.kind === 'stairs' || s.kind === 'elevator') && s.toLevel !== undefined) routePts.push(v3(s.path[0], s.toLevel, 0.9));
    }
    const curve = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < routePts.length; i++) {
      if (routePts[i].distanceTo(routePts[i - 1]) > 1e-3) curve.add(new THREE.LineCurve3(routePts[i - 1], routePts[i]));
    }
    if (curve.curves.length) {
      scene.add(new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(16, curve.curves.length * 8), 0.45, 8, false),
        new THREE.MeshStandardMaterial({ color: '#0040c1' }),
      ));
    }
    const dot = (color: string, at: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshStandardMaterial({ color }));
      m.position.copy(at);
      scene.add(m);
    };
    const step = leg.steps[stepIndex];
    dot('#1a73e8', v3(step.path[0], step.level, 1.2));
    const end = leg.steps.at(-1)!;
    dot('#b00e28', v3(end.path[0], end.level, 1.2));

    // Cámara en diagonal, mirando al centro del edificio.
    const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const size = box.isEmpty() ? 40 : box.getSize(new THREE.Vector3()).length();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, size * 10);
    const viewDir = new THREE.Vector3(-0.55, 0.8, 0.9).normalize();
    /** Aleja la cámara lo justo para que quepa todo el edificio, también en pantallas verticales. */
    const fitCamera = () => {
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dist = (size / 2) / Math.sin(Math.min(vFov, hFov) / 2);
      camera.position.copy(center).addScaledVector(viewDir, dist * 1.1);
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.domElement.className = styles.canvas3d;
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', label);
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;

    // Se reencuadra con cada cambio de tamaño hasta que el usuario gira o acerca la vista.
    let userMoved = false;
    controls.addEventListener('start', () => (userMoved = true));
    fitCamera();
    controls.update();

    const resize = () => {
      const { width, height: h } = el.getBoundingClientRect();
      if (!width || !h) return;
      renderer.setSize(width, h, false);
      camera.aspect = width / h;
      camera.updateProjectionMatrix();
      if (!userMoved) {
        fitCamera();
        controls.update();
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [data, building, leg, stepIndex, label, floorLabel]);

  return <div ref={host} className={styles.canvas3d} />;
}
