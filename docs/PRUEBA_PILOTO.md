# Prueba piloto en campus

Guía para ensayar las pruebas de usabilidad antes de hacerlas con los 5 participantes. Sigue el plan de pruebas del *Design Report* (sección 6: objetivos, tareas, métricas, protocolo, cuestionario y criterios de éxito). Los resultados se anotan en [resultados_piloto.csv](resultados_piloto.csv).

El piloto tiene tres fines:
1. Comprobar que los datos del campus permiten completar las tareas.
2. Encontrar fallas de la app antes de las pruebas formales.
3. Ensayar el protocolo, incluidos los tiempos, la grabación y la hoja de resultados.

Conviene hacerlo con 1 o 2 personas que no conozcan el campus.

---

## 1. Antes del día de la prueba

### Datos (editor, `/editor`)
- [ ] **Caminos exteriores:** importar los de OpenStreetMap y corregirlos al menos en las rutas de las tareas. Hay que borrar lo que no se puede caminar y agregar los atajos reales.
- [ ] **Lugares ubicados:** todos los que aparecen en las tareas, con sus **entradas** marcadas. Para la tarea 5, por ejemplo, Servicios Médicos.
- [ ] **CN e IA levantados:**
  - pisos con contorno;
  - pasillos trazados por el centro;
  - salones de las tareas con su puerta sobre el pasillo;
  - escaleras conectadas entre pisos;
  - entradas;
  - plano anclado al mapa.
- [ ] **Referencias** en giros, escaleras y entradas: "junto a la cafetería", "frente a los baños", "por la puerta principal".
- [ ] **Validación sin errores:** el botón de la barra superior del editor debe decir "Sin errores".
- [ ] **Publicación:** Exportar, reemplazar `public/data/campus.json`, hacer commit y push. Vercel publica solo.

### Recorrido de prueba (un integrante del equipo)
- [ ] Hacer cada ruta de las tareas con la app publicada y el GPS encendido.
- [ ] Anotar giros mal anunciados, recálculos sin motivo y el momento en que aparece "Llegué".
- [ ] Revisar que la guía interior coincida con el edificio real: pasillo correcto, lado de la puerta, escalera.

### Teléfonos
- [ ] Al menos un Android y un iPhone, con el navegador actualizado.
- [ ] Abrir el enlace una vez con internet y esperar unos segundos. Desde ese momento funciona sin conexión.
- [ ] En el iPhone, "Rumbo" pide permiso de brújula la primera vez. Decidan si el permiso se da antes de la prueba o si es parte de la tarea 1.
- [ ] Batería cargada y brillo al máximo.

### Material
- [ ] Formato de consentimiento (sección 6.8 del reporte).
- [ ] Cronómetro y cámara para grabar.
- [ ] Hoja de resultados ([resultados_piloto.csv](resultados_piloto.csv)) impresa o en otro teléfono.
- [ ] Punto de partida marcado en el campus.

---

## 2. Definir las tareas concretas

Llenar antes del piloto. Deben ser lugares que los participantes **no** conozcan.

| Tarea | Qué definir | Valor |
|---|---|---|
| Punto de partida | Lugar fácil de describir (p. ej. "frente a Rectoría") | |
| 2–3 Salón con código | Un salón de CN o IA en un piso distinto al 1 (p. ej. CN-220) | |
| 4 Tiempo límite | Tiempo estimado por la app para esa ruta + 25 % (ver nota) | |
| 5 Lugar sin código | Un servicio (p. ej. Servicios médicos, Gimnasio) | |

> **Tiempo límite (tarea 4).** El reporte pide "un marco de tiempo predefinido" sin fijarlo. Propuesta: tomar la "Caminata estimada" que muestra la app desde el punto de partida y sumarle 25 %, que cubre cruces, puertas y la orientación inicial. Defínanlo **antes** de la primera prueba y usen el mismo para todos.

---

## 3. Guion por participante

Sigue el protocolo de la sección 6.5 del reporte. **No se dan pistas sobre la interfaz**: si el participante pregunta, se responde "haz lo que harías si estuvieras solo".

### 3.1 Bienvenida y consentimiento
1. Explicar el propósito: "Estamos probando una app para encontrar salones en el campus. Evaluamos la app, no a ti".
2. Firmar el consentimiento.
3. Pedir que piense en voz alta: "Por favor, di en voz alta qué estás buscando y por qué tomas cada decisión".
4. Iniciar la grabación.

### 3.2 Tarea 1: controles de la interfaz
**Estado inicial:** app abierta en español, mapa con norte arriba y desplazado a una zona lejana del campus (muévanlo con el dedo antes de entregar el teléfono).

Decir:
> "Cambia el idioma de la app a inglés."
> "Haz que el mapa gire según hacia dónde estás mirando."
> "Haz que el mapa muestre dónde estás tú."

Anotar éxito (sí/no) de cada una por separado.

### 3.3 Tarea 2: salón con código
Decir:
> "Tienes clase en el salón **[código]**. Empieza a navegar hacia él."

Éxito: llega a la pantalla de navegación con el destino correcto. Anotar si usó la explicación de siglas.

### 3.4 Tareas 3 y 4: llegar al salón (y tiempo)
Decir:
> "Ahora ve hasta el salón."

- Iniciar el cronómetro al empezar a caminar y detenerlo cuando el participante esté frente a la puerta correcta, aunque no haya tocado "Llegué".
- **Pausar** el cronómetro si se detiene por algo ajeno a la app, por ejemplo si un conocido lo saluda.
- Seguir al participante y grabar sin intervenir.

Anotar:
- **Tarea 3:** si llegó a la puerta correcta, sí o no.
- **Tarea 4:** el tiempo en segundos y si quedó dentro del límite.
- **Incidentes:** giros equivocados, recálculos, uso de "Detener", si entendió "Estoy en la entrada", si usó el plano 2D o la vista 3D.

### 3.5 Tarea 5: lugar sin código
Desde donde terminó la tarea anterior (o regresando al punto de partida, según lo definan), decir:
> "Ahora necesitas ir a **[lugar]**. Empieza a navegar hacia allá."

Éxito: inicia la navegación hacia el lugar correcto.

### 3.6 Cuestionario (Apéndice A del reporte)
1. ¿Crees que la aplicación es útil? (sí/no)
2. ¿Crees que la aplicación es intuitiva? (sí/no)
3. ¿Tienes otras recomendaciones o quejas sobre la aplicación?

---

## 4. Criterios de éxito (sección 6.7)

| Objetivo | Criterio | Resultado |
|---|---|---|
| 1 Controles (idioma, orientación, ubicación) | ≥ 4 de 5 en cada subtarea | |
| 2 Búsqueda con código | 5 de 5 inician la navegación | |
| 3 Llegar al salón | 5 de 5 llegan | |
| 4 Tiempo | ≥ 4 de 5 dentro del límite | |
| 5 Búsqueda sin código | ≥ 4 de 5 | |
| Cuestionario: útil | ≥ 4 de 5 responden sí | |
| Cuestionario: intuitiva | ≥ 4 de 5 responden sí | |

---

## 5. Calibrar la app con lo observado

Con los datos del piloto se ajustan los valores de la tabla "Ajustes para calibrar" del [README](../README.md):

| Si observan… | Ajuste |
|---|---|
| El tiempo estimado difiere del real | Velocidad real = distancia de la ruta ÷ tiempo medido (sin pausas). Promedien los participantes y actualicen `WALK_SPEED_MPS`. |
| "Te saliste de la ruta" sin haberse desviado | Subir `OFF_ROUTE_M` (p. ej. a 25–30 m) o `OFF_ROUTE_READINGS`. |
| Tarda mucho en recalcular tras un desvío real | Bajar `OFF_ROUTE_READINGS` a 2. |
| "Llegué" aparece demasiado pronto o tarde | Ajustar `NEAR_END_M`. |
| Se anuncian giros en curvas suaves, o faltan giros reales | Ajustar `MIN_TURN_DEG`, o corregir el camino en el editor. |
| Dudan en un cruce | Agregar una referencia a ese punto en el editor. |
| Se pierden dentro del edificio | Revisar pasillos, el lado de las puertas y agregar referencias. |

---

## 6. Seguridad (sección 6.8)

- Un evaluador acompaña siempre al participante, cerca y sin intervenir.
- Recordar que no mire el teléfono al cruzar calles o estacionamientos.
- Si hay riesgo, detener la prueba: la seguridad está antes que la medición.
- Guardar los videos de forma segura y borrarlos según lo que diga el consentimiento.

---

## 7. Limitaciones conocidas que pueden influir en los resultados

- **GPS cerca de edificios:** suele fallar por 10–30 m. Puede provocar recálculos o que "Llegué" aparezca antes de tiempo.
- **Brújula:** en iPhone pide permiso al tocar "Rumbo". En algunos teléfonos es imprecisa cerca de estructuras metálicas.
- **Interiores:** no hay posición automática; se avanza con Siguiente/Anterior. Es una decisión de diseño, pero conviene observar si los participantes la entienden.
- **Reportes de salones faltantes:** el envío es simulado; se guardan solo en ese teléfono.
- **Tiempo límite:** si se define con la velocidad de 1.3 m/s sin calibrar, conviene revisarlo después del piloto, antes de las pruebas formales.
