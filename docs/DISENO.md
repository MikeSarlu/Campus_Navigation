# UDLAP Campus Navigation — Documento de diseño

Versión 0.1 · 2026-11-01 · Basado en el *Design Report* (HCI, Otoño 2026) y en las decisiones acordadas después de leerlo.

---

## 1. Resumen

Aplicación web móvil (PWA) que lleva a un estudiante desde donde está hasta un salón, a partir de un código del horario (p. ej. `CN-220`) o de un nombre común (p. ej. "biblioteca"). La ruta exterior lleva a la entrada del edificio. Después, las instrucciones interiores paso a paso, sobre un plano del piso, llevan hasta la puerta del salón.

**Tipo de entregable:** prototipo funcional con datos reales, listo para las pruebas de usabilidad en campus (sección 6 del reporte).

## 2. Decisiones acordadas

| Tema | Decisión |
|---|---|
| Cobertura | Mapa exterior de todo el campus. Interiores solo de **CN** (Ciencias A‑4) e **IA** (Ingenierías‑2) por ahora |
| Fuente de datos | Levantamiento a mano caminando, con un **editor propio** dentro de la app |
| Formato de código | `SIGLAS-NNN`, siglas en mayúscula. **El primer dígito es el piso** (`CN-220` → piso 2). Sin sótanos |
| Oficinas de profesores (`CN-220A`) | Fuera de alcance por ahora |
| Siglas repetidas | Algunas siglas aparecen en lugares distintos (AG, HU, 1, CL, CC). No se distinguen: cada lugar es un registro propio y la búsqueda devuelve todos |
| Mapa base | OpenStreetMap |
| Rutas | Red de caminos peatonales propia (grafo), con recálculo automático al desviarse |
| Posición en interiores | Instrucciones paso a paso con rastro de la ruta en el plano. El usuario confirma con **"Llegué"** |
| 3D | Vista "explotada" de pisos apilados, generada de los mismos datos. Se ve al llegar a la entrada y con el botón "Ver en 3D" |
| Punto de partida | Flujo normal. Si no hay ubicación, arriba aparece "Elegir punto de partida" |
| Silla de ruedas | **Eliminado** de la interfaz |
| Estados de sistema | Se incluyen carga, sin conexión, sin ubicación y sin brújula |
| Reportes de salones faltantes | Simulados: se guardan en el teléfono con estado borrador / enviado |
| Offline | Descarga automática (PWA), mostrando la fecha de descarga |
| Idioma | Se detecta del navegador. Si no es español ni inglés → español |
| Tiempo estimado | 1.3 m/s (ajuste único y configurable; se calibra después de las pruebas) |
| Estilo visual | Neutral, optimizado para luz solar directa |
| Stack | React + Vite + TypeScript, desplegado en Vercel |

## 3. Alcance

**Incluido:** búsqueda por código y por nombre, explicación de abreviaturas, atajos de categoría, detalle de destino, navegación exterior con recálculo, navegación interior paso a paso (CN, IA), vista 3D, español/inglés, mapa con norte fijo o rotando, botón de ubicación actual, punto de partida manual, uso sin conexión, reporte de salón faltante (simulado), editor de datos.

**Fuera de alcance:** cuentas o perfiles, favoritos, rutas accesibles, oficinas de profesores, interiores de otros edificios, backend real de reportes, posicionamiento en interiores (Wi‑Fi, BLE, QR).

## 4. Arquitectura

```
┌──────────────────────── Navegador móvil (PWA) ────────────────────────┐
│  React UI ── estado (Zustand) ── i18n (diccionarios es/en)           │
│     │                                                                  │
│     ├─ MapLibre GL ── estilo propio "sol" ── teselas locales (campus) │
│     ├─ Motor de rutas (A* sobre grafo exterior+interior)              │
│     ├─ Sensores: Geolocation (watchPosition), DeviceOrientation       │
│     ├─ Vista 3D (three.js / react-three-fiber, carga diferida)        │
│     └─ Service Worker (Workbox): precarga app + datos + teselas       │
│                                                                        │
│  Datos estáticos: /data/campus.json  (generado con el editor)         │
│  Almacenamiento local: reportes, preferencias (idioma, orientación)   │
└────────────────────────────────────────────────────────────────────────┘
          Despliegue: Vercel (HTTPS, necesario para GPS y brújula)
```

### 4.1 Decisiones técnicas y por qué

- **Teselas propias en lugar de los servidores de OSM.** La política de uso de tile.openstreetmap.org prohíbe descargar teselas en bloque para uso sin conexión. `npm run fetch-tiles` extrae del build mundial de Protomaps (datos OSM) solo las teselas vectoriales del campus: 32 archivos `public/tiles/{z}/{x}/{y}.mvt` (≈1.7 MB) más las fuentes de las etiquetas. Se sirven como archivos estáticos desde Vercel (sin servidor de teselas ni librería extra), se pueden precargar sin conexión y permiten un estilo de alto contraste propio. Se usan archivos sueltos en vez de un solo `.pmtiles` porque así no hace falta el protocolo `pmtiles://` en la app ni en el service worker. Se mantiene la atribución "© OpenStreetMap · Protomaps".
- **MapLibre GL:** rotación del mapa por rumbo, inclinación y renderizado vectorial nítido.
- **Grafo propio en el cliente:** el campus es pequeño (cientos de nodos), así que A* corre en milisegundos, sin servidor y también sin conexión.
- **Zustand:** estado global mínimo, sin el boilerplate de Redux.
- **TypeScript:** el modelo de datos (sección 5) lo comparten la app y el editor, y los tipos evitan errores de datos que serían difíciles de detectar en campo.
- **3D con carga diferida:** three.js solo se descarga al abrir la vista 3D y no afecta la carga inicial.

### 4.2 Estructura de carpetas (propuesta)

```
src/
  app/            rutas (/, /editor), layout, providers
  features/
    search/       búsqueda, normalización de códigos, abreviaturas
    map/          MapLibre, controles (idioma, orientación, ubicación)
    navigation/   ruta, instrucciones, recálculo, llegada
    indoor/       plano 2D por piso, pasos, vista 3D
    report/       reporte de salón faltante (local)
    editor/       editor de datos (oculto)
  core/
    data/         tipos, carga y validación de campus.json
    routing/      grafo, A*, generación de instrucciones
    sensors/      geolocalización, brújula y sus permisos
    i18n/         es.json, en.json, detección
  styles/         tokens de diseño
public/
  data/campus.json
  tiles/{z}/{x}/{y}.mvt   (generado con npm run fetch-tiles)
  fonts/                 (glifos de las etiquetas)
```

## 5. Modelo de datos

Todo vive en un solo `campus.json` que el editor genera y valida.

```ts
type LngLat = [number, number];
type Localized = { es: string; en: string };

interface Place {                // cualquier cosa que se puede buscar
  id: string;                    // único interno: "bld-cn", "svc-biblioteca"
  siglas?: string;               // "CN", "HU", "1"… pueden repetirse
  name: Localized;               // "Ciencias A-4"
  kind: 'building' | 'service' | 'sports' | 'residence' | 'garden' | 'parking';
  categories: CategoryId[];      // para los atajos
  location?: LngLat;             // marcador; ausente mientras no se levante en campo
  entranceNodeIds: string[];     // puertas por las que se entra (nodos del grafo)
  buildingId?: string;           // si el servicio está dentro de un edificio
}

type CategoryId = 'comedor' | 'gimnasio' | 'medico' | 'escolares' | 'biblioteca' | 'internacional';

interface Anchor {               // ubica el plano local (metros) en el mapa
  refLocal: [number, number];    // punto de referencia en el plano (p. ej. la entrada principal)
  refWorld: LngLat;              // dónde está ese punto en el mapa
  rotationDeg: number;           // hacia dónde apunta el "arriba" del plano, en grados desde el norte
}

interface Building {
  id: string;                    // "bld-cn"
  siglas: string;                // "CN"
  anchor?: Anchor;
  floors: Floor[];               // vacío si no hay interior levantado
}

interface Floor {
  level: number;                 // 1, 2, 3… (coincide con el primer dígito del código)
  outline: [number, number][];   // contorno en metros locales
  rooms: Room[];
}

interface Room {
  code: string;                  // "CN-220"
  polygon: [number, number][];   // metros locales
  doorNodeId: string;
}

interface GraphNode {
  id: string;
  pos: LngLat;                   // exteriores
  local?: { buildingId: string; level: number; xy: [number, number] }; // interiores
  kind: 'path' | 'entrance' | 'corridor' | 'stairs' | 'elevator' | 'door';
  label?: Localized;             // punto de referencia: "Escaleras junto a la cafetería"
}

interface GraphEdge {
  from: string; to: string;
  lengthM: number;               // calculado
  kind: 'outdoor' | 'indoor' | 'stairs' | 'entrance';
}

interface CampusData {
  version: string;
  generatedAt: string;           // se muestra como "Datos del …" en modo offline
  places: Place[];
  buildings: Building[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}
```

La explicación de abreviaturas se deriva de `places` (siglas → nombre), así que no hay una lista aparte que mantener sincronizada.

**Regla de código:** `^([A-Z0-9]{1,4})-(\d)(\d{2,})$`, donde el grupo 2 es el piso. Las siglas aceptan dígitos porque existe el edificio "1". La búsqueda normaliza la entrada antes de aplicar la regla: `cn220`, `CN 220` y `Cn-220` se convierten en `CN-220`.

## 6. Pantallas y flujo

```
Mapa inicio ──tap búsqueda──▶ Ayuda de búsqueda ──escribir──▶ Resultados
    │                                                        │      │
  atajo de categoría ─────────────────────────────────▶ Resultados  └─▶ Sin resultados ─▶ Reporte
                                                             │
                                                    Detalle de destino
                                                             │ "Caminar"
                                     (sin ubicación) ─▶ Elegir punto de partida
                                                             │
                                                   Navegación exterior ◀─┐ recálculo
                                                             │ geocerca de entrada
                                             Navegación interior (paso a paso, 2D)
                                                   │                 │
                                             "Ver en 3D"          "Llegué"
                                                             │
                                                   Confirmación (verde)
```

### 6.1 Mapa inicio
- Barra de búsqueda arriba con el texto "Buscar aquí…".
- Debajo, atajos: **Comedor, Gimnasio, Servicios médicos, Servicios escolares, Biblioteca, Oficina internacional**.
- Controles a la derecha, cada uno con ícono y texto: **Idioma (ES/EN)**, **Orientación (Norte / Rumbo)** y **Mi ubicación**.
- Punto azul con cono de orientación cuando hay ubicación y rumbo.

### 6.2 Ayuda de búsqueda (búsqueda vacía)
- Ejemplos: "Escribe un código, p. ej. *CN‑220*, o un lugar, p. ej. *biblioteca*".
- Enlace "¿Qué significan los códigos?" que abre la explicación de abreviaturas.
- Acción secundaria: "¿Falta un salón? Repórtalo".

### 6.3 Resultados
- Cada resultado muestra **código o nombre, edificio y piso**. Ejemplo: `CN‑220 · Ciencias A‑4 · Piso 2`.
- Si la consulta contiene siglas conocidas, aparece arriba una tarjeta de explicación: "**CN** = Ciencias A‑4 · el primer número es el piso".
- En los atajos con varios lugares (gimnasios GA/GB/GC), todos se ordenan por distancia.
- **Comedor** muestra solo el comedor universitario.
- Siglas repetidas: aparecen todos los lugares, cada uno con su nombre completo.

### 6.4 Sin resultados
- Se conserva la consulta.
- Sugerencias: revisar el código, buscar por nombre del edificio, ver la explicación de abreviaturas.
- Botón "Reportar salón faltante".

### 6.5 Detalle de destino
- El marcador queda resaltado y el panel inferior muestra nombre, edificio, piso, distancia y "Caminata estimada X min".
- Botón principal grande: **Caminar**.

### 6.6 Elegir punto de partida
Aparece arriba cuando no hay permiso de ubicación o no hay señal. Se puede tocar el mapa o escoger un edificio o lugar de la lista.

### 6.7 Navegación exterior
- Ruta en azul con borde blanco.
- El panel inferior muestra la **siguiente instrucción** (con punto de referencia cuando existe), el tiempo restante y la distancia.
- Botón grande **Detener**. Al detener, el destino sigue seleccionado y reiniciar es un toque.
- La búsqueda se oculta.
- **Recálculo:** si la posición se aleja más de 20 m de la ruta en 3 lecturas seguidas con precisión ≤ 25 m.
- **Botón para recentrar** cuando el usuario mueve el mapa.

### 6.8 Navegación interior
Se activa al entrar en la geocerca de la entrada (unos 15 m), o manualmente con "Ya estoy en la entrada".
- Plano 2D del piso actual con el **rastro de la ruta**. Las partes ya recorridas se atenúan.
- Instrucción paso a paso, por ejemplo "Sube por las escaleras a tu derecha hasta el piso 2". Se avanza con **Siguiente**/**Anterior** o deslizando.
- Selector de piso, que cambia solo al avanzar a un paso de escaleras.
- **Ver en 3D:** pisos apilados con la ruta conectada por las escaleras. Se muestra una vez automáticamente al entrar y después bajo demanda.
- Botón **Llegué** siempre visible en el último paso.

### 6.9 Confirmación de llegada
Pantalla verde: "Llegaste a CN‑220". Botón "Listo".

### 6.10 Reporte de salón faltante
- Campos: código, edificio, piso (se sugiere a partir del código) y detalles opcionales. Casilla opcional para adjuntar la ubicación GPS.
- Estados visibles: **Borrador** (sin conexión) → **Enviado (simulado)**, con un mensaje de que "será revisado antes de aparecer en el mapa".

### 6.11 Estados del sistema
| Estado | Comportamiento |
|---|---|
| Cargando | Esqueleto del mapa y spinner solo si tarda más de 300 ms |
| Sin conexión | Aviso discreto: "Sin conexión · datos del 12 nov 2026". Todo sigue funcionando |
| Sin permiso de ubicación | El control "Mi ubicación" explica cómo activarlo. Se ofrece el punto de partida manual |
| Señal GPS imprecisa | Círculo de precisión grande y aviso "Ubicación aproximada" |
| Sin brújula / iOS sin permiso | El modo "Rumbo" pide permiso con un toque. Si no hay sensor, se queda en norte fijo y lo avisa |
| Fuera del campus | "Estás fuera del campus. La ruta empieza en el acceso más cercano" |

## 7. Lineamientos visuales (luz solar)

- **Contraste:** objetivo WCAG **AAA** (7:1) para texto y controles esenciales.
- **Colores:** fondo `#FFFFFF`; texto `#0B0B0B`; ruta `#0040C1` de 8 px con borde blanco de 3 px; destino `#C8102E`; llegada `#0A7A2F`; sin grises claros para información.
- **Mapa:** estilo propio desaturado, con edificios en gris medio con contorno oscuro y etiquetas grandes con halo blanco, para que la ruta azul domine.
- **Tipografía:** Inter o la del sistema, 17 px mínimo para el cuerpo y 22–28 px para la instrucción de navegación, con peso 600+ en lo importante.
- **Toques:** objetivos de 48 × 48 px mínimo y acciones principales abajo (alcance con una mano).
- **Nunca solo color:** cada estado combina ícono, texto y forma.
- **Movimiento:** respeta `prefers-reduced-motion`.
- **Botón Atrás del sistema:** cada panel es una entrada del historial, así que "Atrás" cierra el panel actual.

## 8. Editor de datos (`/editor`, oculto)

**Objetivo:** que ustedes levanten el campus caminando y exporten `campus.json` sin tocar código.

### 8.1 Modo exterior
- Dibujar y editar caminos peatonales sobre el mapa. Al unir líneas se crean nodos automáticamente.
- **"Marcar aquí con GPS":** promedia varias lecturas y muestra la precisión, para colocar entradas o puntos de camino mientras caminan.
- Crear y editar lugares: siglas, nombre es/en, tipo, categorías y entradas.

### 8.2 Modo interior
- Por edificio y piso: subir una foto o croquis de fondo.
- Calibrar la escala marcando 2 puntos con distancia conocida.
- Anclar el plano al mapa con la entrada principal y una rotación.
- Dibujar el contorno, los pasillos (grafo), los salones (polígono + código + puerta), las escaleras (enlazadas entre pisos) y los puntos de referencia.

### 8.3 Validación antes de exportar
- Salones no alcanzables desde una entrada.
- Códigos cuyo primer dígito no coincide con el piso.
- Escaleras sin pareja en el otro piso.
- Nodos sueltos.

### 8.4 Guardado
Autoguardado local en IndexedDB, más **Exportar/Importar JSON**. El archivo exportado se coloca en `public/data/campus.json` y se despliega. Los fondos de los pisos son solo una ayuda para calcar: se quedan en el navegador y no van en `campus.json`.

### 8.5 Mapa base del editor
El editor usa teselas en línea (OpenStreetMap o satélite de Esri) porque solo se usa con conexión. La app usa las teselas locales del campus (§4.1).

## 9. Rutas e instrucciones

- **Grafo único:** caminos exteriores → nodo de entrada → pasillos por piso → aristas de escaleras → puerta del salón.
- **Costo:** distancia en metros. Las escaleras suman además un tiempo equivalente por piso (ajustable).
- **Instrucciones:** se generan a partir de los cambios de ángulo (≥ 35°: "gira a la izquierda/derecha"). Se prefiere mencionar el punto de referencia más cercano al giro.
- **Tiempo:** `distancia / 1.3 m/s` + penalización de escaleras. El texto dice "Caminata estimada", nunca "hora actual".
- **Recálculo:** desde la posición actual hacia el nodo más cercano del grafo.

## 10. Idioma

Detección con `navigator.languages`: el primer idioma que empiece con `es` o `en` gana; si no hay ninguno, español. Con el botón ES/EN la elección se guarda en el dispositivo. Los textos de la interfaz, los nombres de lugares y las instrucciones son bilingües.

## 11. Plan de implementación

| Fase | Entregable |
|---|---|
| 0 | Proyecto base (Vite + React + TS), tokens de diseño, i18n, carga de `campus.json` con datos de ejemplo, despliegue inicial en Vercel |
| 1 | **Editor**: modo exterior y modo interior, validación, export/import |
| 2 | Mapa (teselas locales + estilo "sol"), controles, búsqueda, abreviaturas, atajos, detalle |
| 3 | Rutas exteriores, navegación, recálculo, punto de partida manual, estados de sensores |
| 4 | Navegación interior paso a paso, selector de piso, vista 3D, "Llegué" |
| 5 | PWA sin conexión, reportes simulados, estados de carga y conexión |
| 6 | Revisión de accesibilidad (contraste AAA, lector de pantalla, botón atrás) y prueba piloto en campus |

El levantamiento de datos (de ustedes) puede empezar en cuanto esté la fase 1.

## 12. Riesgos y pendientes

- **Cobertura de OSM en la UDLAP:** no se pudo verificar (el servidor Overpass falló). Se revisará en la fase 2. Si falta información, los caminos se dibujan con el editor.
- **Precisión GPS cerca de edificios:** de 10 a 30 m es normal. La geocerca de la entrada y el umbral de recálculo deben ajustarse en campo.
- **Brújula en iOS:** requiere un toque del usuario para dar permiso y es poco precisa cerca de estructuras metálicas. La tarea 1 de las pruebas lo pondrá en evidencia.
- **Calidad de los planos levantados a mano:** influye directamente en la tarea 3 de las pruebas (encontrar el salón). Conviene validar cada piso caminándolo con la app antes de las pruebas.
- **Siglas repetidas:** pueden confundir al buscar "HU" o "CL". La mitigación es mostrar siempre el nombre completo y la ubicación en cada resultado.
