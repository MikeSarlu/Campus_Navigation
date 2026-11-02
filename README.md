# UDLAP Campus Navigation

Prototipo de app web móvil para navegar el campus de la UDLAP. El diseño completo está en [docs/DISENO.md](docs/DISENO.md).

## Desarrollo

Requiere Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173 (también accesible desde el celular en la misma red)
npm test         # pruebas unitarias
npm run build    # compilación de producción en dist/
```

## Mapa base

Las teselas del campus están en `public/tiles/` y las fuentes de las etiquetas en `public/fonts/` (datos de OpenStreetMap vía Protomaps). Para actualizarlas con los datos más recientes de OSM:

```bash
npm run fetch-tiles
```

## Datos

Todo el contenido del campus vive en `public/data/campus.json` (modelo en `src/core/data/types.ts`). Por ahora contiene los lugares y siglas del mapa oficial, **sin coordenadas**: se levantan con el editor (fase 1).

## Editor de datos (`/editor`)

Abre `http://localhost:5173/editor` (o `/editor` en el sitio publicado). Los textos del editor están solo en español porque es una herramienta interna.

- **Exterior:** se dibujan caminos peatonales, se ubican lugares y se marcan entradas sobre el mapa, con fondo de OpenStreetMap o de satélite. **Marcar con GPS** promedia varias lecturas mientras estás quieto, así que la precisión mejora con el tiempo.
- **Importar caminos del campus** (al final del panel exterior) agrega los caminos y calles que OpenStreetMap ya tiene dentro del campus (unos 650 puntos, 99 % conectados). Úsenlo una vez como base y después corrijan: borren lo que no se pueda caminar y agreguen lo que falte.
- **Interior:** se elige edificio y piso, se sube una foto o croquis de fondo y se calibra la escala. Luego se dibujan contorno, pasillos, salones (código y puerta), escaleras y entradas. Por último se marca un punto de referencia y se ubica en el mapa para anclar el plano.
- El botón de errores revisa los datos: salones sin camino desde una entrada, códigos que no coinciden con el piso, escaleras sin pareja, etc.

**Importante sobre cómo se guarda el trabajo:**

- Los cambios se guardan solos, pero **solo en ese navegador** (IndexedDB). Para pasar trabajo de un dispositivo a otro (por ejemplo, del celular al caminar a la laptop), usa **Exportar** en uno e **Importar** en el otro. Importar *reemplaza* lo que había; no combina.
- Trabajen sobre un solo archivo a la vez y pásenlo de mano en mano para no perder cambios.
- Los fondos de los pisos no se incluyen en `campus.json`: se quedan en el navegador donde se subieron.
- Para publicar, reemplaza `public/data/campus.json` con el archivo exportado y despliega.
- **Ver en la app** (barra superior del editor) abre la app con tu borrador (`/?datos=editor`) para revisarlo antes de exportar. Funciona en el mismo navegador donde editas.
- **GPS en el celular:** el navegador solo da la ubicación en sitios HTTPS. Con `npm run dev` abierto desde el celular por la red local no funciona; usa la versión publicada en Vercel.

## Ajustes para calibrar en las pruebas

Valores pensados para ajustarse después de probar en campus:

| Ajuste | Valor | Archivo |
|---|---|---|
| Velocidad de caminata | 1.3 m/s | `src/core/routing/route.ts` (`WALK_SPEED_MPS`) |
| Tiempo extra por piso de escaleras | 10 s | `src/core/routing/route.ts` (`STAIRS_EXTRA_S_PER_FLOOR`) |
| Distancia para considerar que te saliste de la ruta | 20 m | `src/features/navigation/navStore.ts` (`OFF_ROUTE_M`) |
| Lecturas seguidas fuera de ruta antes de recalcular | 3 | `src/features/navigation/navStore.ts` (`OFF_ROUTE_READINGS`) |
| Precisión mínima del GPS para recalcular | 25 m | `src/features/navigation/navStore.ts` (`TRUSTED_ACCURACY_M`) |
| Distancia al final para mostrar "Llegué" | 25 m | `src/features/navigation/navStore.ts` (`NEAR_END_M`) |
| Ángulo mínimo para anunciar un giro | 35° | `src/core/routing/instructions.ts` (`MIN_TURN_DEG`) |

## Despliegue

Pensado para Vercel: importar el repositorio y usar la configuración detectada para Vite. `vercel.json` redirige las rutas de la app (como `/editor`) a `index.html`. Vercel sirve por HTTPS, que es obligatorio para el GPS y la brújula.
