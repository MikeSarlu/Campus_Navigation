# Revisión de accesibilidad

Revisión de la fase 6 frente a los lineamientos del documento de diseño (§7) y las WCAG 2.2.

## Verificado automáticamente

| Qué | Cómo | Resultado |
|---|---|---|
| Contraste del texto (AAA, 7:1) | `src/styles/contrast.test.ts`, corre con `npm test` | 14 pares texto/fondo cumplen |
| Contraste de la ruta, el pin y el punto azul sobre el mapa (3:1) | Misma prueba | Cumplen |
| Reglas WCAG 2.0/2.1/2.2 A y AA y buenas prácticas | axe-core en 11 vistas: inicio, ayuda de búsqueda, resultados, sin resultados, detalle, reporte, elegir partida, navegación, interior 2D, interior 3D, llegada | 0 violaciones |

Para repetir la auditoría con axe: `npm run dev`, abrir la app, ir a la vista que se quiere revisar y ejecutar `await __axe()` en la consola del navegador. La función solo existe en desarrollo.

## Cambios hechos en esta revisión

- **Colores más oscuros para cumplir AAA** con texto blanco encima y como texto sobre blanco:
  - Rojo del destino y del botón Detener: de `#c8102e` (5.9:1) a `#b00e28` (7.1:1).
  - Verde de llegada y "Llegué": de `#0a7a2f` (5.5:1) a `#086627` (7.1:1).
  - Morado del aviso de vista previa: de `#7a2fd0` a `#732cc4`.
- **Botón "i" de la atribución del mapa:** pasó de 24 px a 36 px, y los controles ya no se le enciman al elegir el punto de partida (WCAG 2.2, tamaño mínimo del objetivo).
- **Foco al cambiar de vista:** el foco pasa al título de la vista nueva (detalle, punto de partida, navegación, interior, llegada, reporte). Antes se perdía porque el botón tocado desaparecía, y el lector de pantalla no anunciaba nada.

## Lo que ya cumplía el diseño

- Todo control tiene texto visible o `aria-label`, y ningún estado depende solo del color.
- Objetivos táctiles de 44–64 px.
- La instrucción de navegación está en una región `aria-live`, así que el lector de pantalla anuncia cada paso. Los avisos usan `role="status"`.
- El botón Atrás del teléfono cierra el panel abierto, en todas las vistas.
- `lang` del documento cambia con el idioma (es/en).
- Se respeta `prefers-reduced-motion`.

## Pendiente: revisión manual en un teléfono real

- [ ] **TalkBack (Android) y VoiceOver (iPhone):** buscar un salón, abrir el detalle, empezar a caminar y avanzar pasos en interiores, solo con el lector de pantalla.
- [ ] **Texto grande:** con el tamaño de letra del sistema al máximo y el zoom del navegador al 200 %, revisar que nada se corte ni se encime.
- [ ] **Luz del sol:** leer la instrucción de navegación y el plano interior al aire libre a mediodía, con brillo automático.
- [ ] **Una mano:** confirmar que Caminar, Detener, Siguiente y Llegué se alcanzan con el pulgar.

## Limitaciones conocidas

- **El mapa es un `<canvas>`:** el lector de pantalla no puede recorrer sus marcadores. La alternativa accesible es la búsqueda y los atajos de categoría, que dan los mismos destinos como lista.
- **La vista 3D es solo visual:** tiene una descripción (`aria-label`), y los mismos pasos están en texto en la tarjeta de instrucciones.
- **El editor (`/editor`)** es una herramienta interna y no se auditó con el mismo nivel.
