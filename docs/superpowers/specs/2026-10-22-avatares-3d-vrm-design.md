# Avatares 3D (VRM) — diseño

- Fecha: 22-oct-2026
- Estado: aprobado en conversación, pendiente de revisión escrita
- Versión objetivo: 0.3.0

## 1. Objetivo

Añadir a Waifu Desk skins 3D en formato **VRM** junto a las 2D actuales. La waifu 3D flota en el escritorio igual que Noa (ventana transparente, clic que atraviesa las zonas vacías, arrastrar, bocadillo, voz) y además:

- hace todo lo que hace la 2D: respirar, parpadear, mover los labios con la voz, mirar al cursor y cambiar de pose según el estado (`idle`, `thinking`, `listening`, `working`, `talking`, `error`);
- tiene animaciones de cuerpo (reposo, pensar, escuchar, trabajar, gestos al hablar, saludo, alegría);
- pone caras según la emoción que marca el modelo de IA;
- permite elegir el encuadre (cuerpo entero, medio cuerpo, busto) con zoom y ángulo.

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Origen de los modelos | Importar VRM ya hechos (VRoid Hub, Booth, VRoid Studio). Generar 3D desde un dibujo queda fuera. |
| Alcance v1 | Lo mismo que la 2D + animaciones de cuerpo + emociones según la IA + encuadre ajustable. |
| Animaciones | Set propio con licencia MIT + importación de `.vrma` y `.fbx` de Mixamo asignables a cada estado o gesto. |
| Tecnología | three.js + @pixiv/three-vrm en la ventana del avatar actual, como segundo renderizador con la misma interfaz que el 2D. |

### Fuera de alcance

- Convertir un dibujo o una foto en un modelo 3D.
- Emociones en la skin 2D (la 2D ignora la señal de emoción).
- Visemas reales a partir del TTS (seguimos con lip-sync por amplitud).
- Android/iOS (el diseño no lo impide: three.js funciona en un WebView).
- Incluir dentro de la app animaciones de terceros cuya licencia prohíba redistribuirlas (p. ej. el pack VRMA de VRoid). El usuario puede importarlas él.

## 2. Arquitectura

### 2.1 Dependencias y carga de módulos

Nuevas dependencias de `package.json` (todas MIT):

- `three` 0.186.x
- `@pixiv/three-vrm` 3.5.x
- `@pixiv/three-vrm-animation` 3.5.x

Seguimos sin bundler. Los módulos se sirven desde `node_modules` por `app://local/bundle/…`:

- `BUNDLE_ALLOWED` (en `src/main/main.js`) y `build.files` (en `package.json`) se amplían solo con lo necesario:
  - `node_modules/three/build/three.module.js` y `three.core.js`
  - `node_modules/three/examples/jsm/loaders/GLTFLoader.js` y `FBXLoader.js`
  - sus dependencias: `examples/jsm/utils/BufferGeometryUtils.js`, `utils/SkeletonUtils.js`, `libs/fflate.module.js`, `curves/NURBSCurve.js`, `curves/NURBSUtils.js`
  - `node_modules/@pixiv/three-vrm/lib/three-vrm.module.js`
  - `node_modules/@pixiv/three-vrm-animation/lib/three-vrm-animation.module.js`
- `avatar.html` y `editor.html` llevan un `<script type="importmap">` que resuelve `three`, `three/addons/`, `@pixiv/three-vrm` y `@pixiv/three-vrm-animation` a esas rutas. La CSP de ambas páginas autoriza ese import map añadiendo a `script-src` el hash SHA-256 de su contenido (sin `'unsafe-inline'`). Un test comprueba que el hash de la CSP coincide con el contenido del import map.
- Las páginas que no usan 3D (chat, ajustes) no cambian.

### 2.2 Interfaz común de renderizador

`avatar.js` y el editor trabajan contra esta interfaz, que cumplen `SkinRenderer` (2D, existente) y `VrmRenderer` (nuevo):

| Miembro | Uso |
|---|---|
| `load(skin)` → `Promise<skin>` | Carga la skin (manifiesto ya resuelto por el main). |
| `layout(box)` | Coloca el avatar dentro del canvas (px CSS). |
| `render(dt)` | Dibuja un fotograma con el estado actual del adaptador. |
| `aspect` | Proporción ancho/alto deseada para la ventana (2D: la de la imagen; VRM: la del encuadre). |
| `headAnchorCss()` → `[x, y]` | Punto de la cabeza en px CSS: cola del bocadillo y origen de la mirada. Sustituye a `imageToCss(rig.neck…)`. |
| `alphaAtCss(x, y, r)` | Opacidad bajo el cursor (clic que atraviesa). |
| `shapeRects(cell, pad)` | Rectángulos de la silueta (recorte de ventana en Linux). |
| `dispose()` | Libera GPU y listeners. |

`avatar.js` elige el renderizador por `skin.type` (`'2d'` por defecto, `'vrm'`). Al cambiar de tipo destruye el renderizador y sustituye el `<canvas>` por uno nuevo (un canvas no admite dos contextos). `desiredSize()` usa `renderer.aspect` en lugar de `skin.width / skin.height`.

### 2.3 Comportamiento separado del dibujo

El `Animator` actual mezcla decidir qué hace el avatar y traducirlo a parámetros de la malla 2D. Se divide en:

- **`src/renderer/shared/behaviour.js`** — decide. Cada fotograma produce señales normalizadas e independientes del renderizador:

  ```js
  {
    state,            // 'idle' | 'thinking' | 'listening' | 'working' | 'talking' | 'error'
    breath,           // -1..1
    blink,            // 0..1
    mouth,            // 0..1 (nivel de audio suavizado o charla simulada)
    look: { x, y },   // -1..1 respecto a la cabeza (cursor + balanceo + pose del estado)
    hop,              // 0..1 (saltito en curso)
    emotion: { name, weight }, // name: 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised'
    talking,          // bool
    events,           // sucesos de un solo fotograma: 'greet' (se abre el chat), 'done' (termina una respuesta)
  }
  ```

  Conserva los tiempos y la lógica actuales: parpadeo aleatorio y doble, suavizado de la boca, charla simulada para voces del sistema, decaimiento del saltito.

- **`src/renderer/shared/drive-2d.js`** — traduce las señales a `renderer.params` del 2D con exactamente las mismas fórmulas de hoy (ángulo de cabeza, desplazamientos en px de imagen, rebote). La skin 2D no cambia de aspecto ni de movimiento.
- **`src/renderer/shared/vrm/drive-vrm.js`** — traduce las señales al VRM (ver §3).

`behaviour.js` y `drive-2d.js` son módulos puros (sin DOM) y se prueban con `node:test`.

### 2.4 Módulos nuevos del 3D

Todos en `src/renderer/shared/vrm/`:

| Archivo | Responsabilidad |
|---|---|
| `vrm-renderer.js` | `WebGLRenderer` con `alpha: true`, escena, cámara, luces, carga del VRM (`GLTFLoader` + `VRMLoaderPlugin`), `VRMUtils.rotateVRM0` para VRM 0.x, encuadre, bucle de `vrm.update(dt)`. Implementa la interfaz de §2.2. |
| `drive-vrm.js` | Señales → expresiones, mirada, capa procedural y peticiones a `motion.js`. |
| `motion.js` | `AnimationMixer` con las capas de §3.1, fundidos y elección de clips. |
| `clips/*.js` | Animaciones propias como datos: pistas de cuaterniones de los huesos humanoides normalizados → `THREE.AnimationClip`. |
| `import-clip.js` | `.vrma` → clip (`VRMAnimationLoaderPlugin` + `createVRMAnimationClip`); `.fbx` de Mixamo → clip (mapa `mixamorig:*` → huesos VRM y corrección de rotaciones de reposo). |
| `framing.js` | Cálculo puro de cámara y proporción a partir de posiciones de huesos y del encuadre elegido. |
| `hit-mask.js` | Máscara de alfa en baja resolución para `alphaAtCss` y `shapeRects`. |

Fuera del renderizador:

| Archivo | Cambio |
|---|---|
| `src/main/llm/emotion.js` (nuevo) | Filtro de etiquetas de emoción en streaming (§3.5). |
| `src/main/llm/agent.js` | Pasa el texto por el filtro, emite `{ type: 'emotion', name }` y guarda en el historial el texto sin etiquetas. Añade la instrucción de emociones al prompt de sistema si están activadas. |
| `src/main/main.js` | Reenvía `emotion` al avatar (`avatar:emotion`). Amplía `BUNDLE_ALLOWED`. IPC de importación de VRM y movimientos. |
| `src/main/skins.js` | Skins VRM (guardar copiando el archivo, no por data URL), biblioteca de movimientos. |
| `src/main/config.js` | `ui.emotions` (bool, por defecto `true`) y `motions.assign` (§4.2). |
| `src/renderer/avatar/avatar.js` | Elige renderizador, usa `behaviour` + adaptador, escucha `avatar:emotion`. |
| `src/renderer/shared/animator.js` | Se elimina; su lógica pasa a `behaviour.js` + `drive-2d.js`. |
| `src/renderer/editor/*` | Pestaña «3D (VRM)» y sección «Movimientos» (§4.3). |
| `src/shared/i18n/locales/*.js` | Textos nuevos en es, en, ru, uk, zh. |

## 3. Comportamiento del avatar 3D

### 3.1 Capas de movimiento (`motion.js`)

1. **Clip del estado**, en bucle, con fundido cruzado de ~0,4 s al cambiar de estado. Un clip por estado: `idle`, `thinking`, `listening`, `working`, `talking`. `error` usa el de `idle`. Con dos variantes de reposo, alterna entre ellas cada 20–40 s.
2. **Gestos de una vez**, superpuestos al clip del estado y con fundido de entrada y salida: `greet` (suceso `greet`), `happy` (suceso `done` o emoción `happy`) y `talkGesture` (uno al azar cada 4–8 s mientras `talking`, decidido por `motion.js`). En la 2D, `greet` y `done` siguen produciendo el saltito de siempre.
3. **Capa procedural**, que se aplica después del mezclador en cada fotograma:
   - respiración: rotación leve de `spine`/`chest` y elevación de hombros según `breath`;
   - balanceo: oscilación lenta de `hips`/`spine`;
   - mirada: los ojos con `vrm.lookAt` hacia un objetivo derivado de `look`, y el 40 % del giro repartido entre `neck` y `head`, sumado a la rotación que traiga el clip;
   - saltito: desplazamiento vertical de `hips` según `hop`.

Así los clips importados también respiran y miran al cursor.

### 3.2 Animaciones propias (`clips/`)

Set inicial, con licencia MIT y escrito como datos:

- `idle-a`, `idle-b`: peso sobre una pierna, brazos relajados, pequeños cambios de postura.
- `thinking`: mano a la barbilla, mirada arriba y a un lado.
- `listening`: inclinación hacia delante y cabeza ladeada.
- `working`: mirada de reojo, brazos como tecleando.
- `talking`: postura abierta, con base para los gestos.
- `talk-1`, `talk-2`, `talk-3`: gestos de mano al hablar.
- `greet`: saludo con la mano.
- `happy`: brazos arriba con un saltito.

Se ajustan renderizando capturas con la skin de serie y revisándolas, no a ciegas.

### 3.3 Clips importados

- Formatos: `.vrma` (VRM Animation) y `.fbx` exportado de Mixamo (sin piel o con ella).
- El FBX se convierte con el mapa de huesos de Mixamo a los huesos humanoides VRM y se corrigen la rotación de reposo y la escala de la cadera (método del ejemplo oficial de three-vrm). Los huesos que no se reconocen se ignoran y se informa de ellos.
- Los clips importados viven en una biblioteca global (§4.2) y se pueden asignar a cualquier estado o gesto. Si no hay nada asignado, se usa el propio.

### 3.4 Labios, parpadeo y mirada

- **Labios**: `mouth` mueve la expresión `aa`. Mientras hay voz, se reparte entre `aa`, `ih`, `ou`, `ee` y `oh` con una variación pseudoaleatoria suave (cambia de vocal cada 90–160 ms), manteniendo la suma igual a `mouth`.
- **Parpadeo**: expresión `blink` con `blink`. Se anula mientras `happy` pesa más de 0,5, porque en muchos modelos la sonrisa ya cierra los ojos.
- **Mirada**: con `ui.followCursor` desactivado, `look` solo lleva el balanceo y la pose del estado.

### 3.5 Emociones

- **Prompt**: si `ui.emotions` está activado, `buildSystemPrompt` añade una instrucción en inglés: puede empezar una frase con una etiqueta `<emo:NAME>` (`happy`, `angry`, `sad`, `relaxed`, `surprised`, `neutral`) cuando el tono cambie de verdad, sin abusar, y nunca dentro de bloques de código.
- **Filtro** (`emotion.js`): clase `EmotionTagFilter` con `push(delta)` → `{ text, emotions[] }` y `flush()`. Retiene en un búfer cualquier final de trozo que pueda ser el principio de una etiqueta (`<`, `<e`, `<emo:hap`…) hasta poder decidir. Una etiqueta con nombre desconocido se elimina sin emitir nada. Lo que no es etiqueta (`<div>`, `a < b`) pasa intacto. Dentro de bloques de código (los delimitados con tres acentos graves) no se filtra.
- **Flujo**: `agent.js` envuelve `onText` con el filtro. El chat, el TTS y el historial reciben el texto ya limpio. Cada emoción produce `emit({ type: 'emotion', name })`, que `main.js` envía al avatar como `avatar:emotion`.
- **En el avatar**: `behaviour` sube `emotion.weight` a 1 en ~250 ms, la mantiene 4 s (o hasta la siguiente etiqueta) y baja a 0 en ~800 ms. `drive-vrm` la aplica a la expresión del mismo nombre si el modelo la tiene. Con `happy` se lanza además el gesto `happy`. La 2D lo ignora.
- **Ajustes**: interruptor «Emociones de la IA» en Ajustes → General. Si está apagado, el prompt no cambia (el filtro sigue activo por si el historial trae etiquetas).

### 3.6 Encuadre (`framing.js`)

- Presets: `full` (de pies a cabeza), `half` (de la cadera a la cabeza) y `bust` (del pecho a la cabeza), calculados con las posiciones en reposo de `head`, `hips`, `chest` y los pies de cada modelo, más un margen.
- Ajustes finos por skin: `zoom` (0,6–1,6), `yaw` (giro del modelo, −45°…45°), `pitch` (inclinación de la cámara, −15°…15°) y `offsetY` (−0,2…0,2 de la altura del encuadre).
- Cámara en perspectiva con FOV vertical de 20°. `aspect` sale del encuadre y de él, el tamaño de la ventana.

## 4. Skins, movimientos e importación

### 4.1 Manifiesto de skin VRM

```json
{
  "id": "skin-abc123",
  "type": "vrm",
  "name": "Shino",
  "files": { "model": "model.vrm", "thumb": "thumb.png" },
  "framing": { "preset": "half", "zoom": 1, "yaw": 0, "pitch": 0, "offsetY": 0 },
  "meta": { "title": "Sendagaya Shino", "authors": ["VRoid Project"], "version": "0", "license": { "licenseName": "CC0", "commercialUssageName": "Allow" } },
  "created": 0,
  "updated": 0
}
```

- `meta.license` copia lo que declara el VRM (en 1.0: `avatarPermission`, `commercialUsage`, `allowRedistribution`, `modification`, `licenseUrl`…; en 0.x: `allowedUserName`, `commercialUssageName`, `licenseName`…).
- Los manifiestos sin `type` se tratan como `'2d'`; las skins existentes no se migran.
- `skins.js`: `saveVrmSkin({ sourcePath | url, name, framing, thumbDataUrl })` copia o descarga el `.vrm` a la carpeta de la skin, sin pasarlo por data URL. Límite de tamaño: 150 MB.

### 4.2 Biblioteca de movimientos

- Carpeta `userData/motions/` con los archivos importados y `motions.json`: `[{ id, name, file, format: 'vrma'|'fbx', duration, missingBones: [] }]`.
- Asignación global en la configuración: `motions.assign = { idle, thinking, listening, working, talking, greet, happy, talkGesture: [] }`. Cada valor es el `id` de un movimiento importado o `null` (= el propio).

### 4.3 Editor

- **Pestaña «3D (VRM)»**:
  1. «Elegir archivo…» (diálogo del sistema en el proceso principal) o «Desde URL».
  2. Validación en el editor: debe cargar como VRM 0.x o 1.0 y tener `vrm.humanoid`; si no, mensaje con el motivo.
  3. Panel de licencia con lo que declara el modelo.
  4. Vista previa en vivo con el renderizador real: presets de encuadre y controles de zoom, giro, inclinación y altura; botones para probar estados, emociones y gestos.
  5. Nombre y «Guardar». La miniatura se genera desde el render.
- **Sección «Movimientos»**: importar `.vrma`/`.fbx`, lista con nombre, duración y huesos que faltan, «Probar» sobre el modelo de la vista previa, asignar a estado o gesto y borrar.

### 4.4 Skin 3D de serie

- Una de las modelos de ejemplo de VRoid publicadas con licencia **CC0** (AvatarSample D–G, Sendagaya Shino, Sakurada Fumiriya; entre 11 y 17 MB). La elige el usuario a partir de renders de las candidatas.
- Va en `assets/skins/<id>/` con su `skin.json`, una miniatura y un `LICENSE.txt` que recoge el origen y la licencia CC0.
- Noa 2D sigue siendo la skin por defecto.

## 5. Rendimiento

- Fotogramas por segundo: 30 en reposo, 60 cuando `talking`, durante fundidos, gestos o saltitos, y mientras arrastras la ventana. Con la ventana oculta, el bucle se para.
- `setPixelRatio(min(devicePixelRatio, 1.5))`, sin sombras, `antialias: true`, contornos MToon activos.
- La física de pelo y ropa (`vrm.springBoneManager`) avanza con paso fijo de 1/60 s, con un máximo de 3 subpasos por fotograma.
- `hit-mask.js`: cada ~100 ms, justo después de un `render()` y en la misma tarea, copia el canvas WebGL a un canvas 2D de ¼ de resolución y guarda el canal alfa. Sin `preserveDrawingBuffer`. `alphaAtCss` y `shapeRects` leen de esa máscara.
- Medición: el smoke registra en el log el tiempo medio de `render()` (en CI es render por software, así que solo sirve para detectar saltos entre versiones). En el PC del usuario, objetivo < 8 ms por fotograma; si no se alcanza, se baja la resolución máxima a 1x antes de seguir.

## 6. Errores

| Situación | Comportamiento |
|---|---|
| El VRM de la skin activa no carga (archivo borrado, corrupto, sin WebGL2) | Bocadillo de error con el motivo, se registra en el log y se carga Noa 2D. La configuración conserva la skin elegida para reintentar en el próximo arranque. |
| Archivo inválido al importar | Mensaje en el editor con el motivo (no es glTF, no es VRM, no tiene humanoide, demasiado grande). No se guarda nada. |
| Descarga por URL falla | Mensaje con el estado HTTP, igual que la importación de imágenes. |
| Estado sin clip asignado ni propio | Solo capa procedural. |
| FBX con huesos no reconocidos | Se importa y se listan los huesos que faltan. |
| Movimiento asignado cuyo archivo ya no existe | Se usa el propio y se avisa en el log. |
| El modelo no tiene alguna expresión (`blink`, `aa`, `happy`…) | Esa señal se ignora en ese modelo. |
| Pérdida del contexto WebGL | Se recarga la ventana (como ahora). |

## 7. Pruebas

**Unitarias (`node:test`)**:
- `emotion.test.mjs`: etiquetas completas, partidas en cualquier posición entre trozos, nombres desconocidos, `<` que no son etiqueta, bloques de código, `flush()` con búfer pendiente.
- `behaviour.test.mjs`: señales con tiempos simulados (parpadeo, decaimiento de emoción, boca, saltito, mirada con y sin cursor).
- `drive-2d.test.mjs`: mismas salidas que el `Animator` actual para las mismas entradas (no hay regresión en 2D).
- `framing.test.mjs`: cámara y proporción para los tres presets con un esqueleto de prueba.
- `mixamo-map.test.mjs`: mapa de huesos completo y detección de los que faltan.
- `skins.test.mjs`: manifiestos VRM válidos o inválidos, `type` por defecto, límite de tamaño.
- `agent.test.mjs` (ampliado): con el servidor simulado, el texto llega limpio al chat y al historial y se emiten los eventos `emotion`.

**Smoke (`npm run smoke`)**, ampliado:
- Activa la skin VRM de serie, espera a que cargue, comprueba que la máscara de alfa tiene píxeles opacos y registra el tiempo medio de fotograma.
- Recorre los estados y las emociones y abre el editor en la pestaña 3D, sin errores de consola, en los 5 idiomas, buscando claves sin traducir.
- Vuelve a la skin 2D y comprueba que sigue dibujando.

**Capturas**: `npm run screenshots` añade la waifu 3D al README.

## 8. Entrega

- Versión 0.3.0 con su apartado en `CHANGELOG.md`. La release la crea el workflow existente.
- README (es/en): sección de skins 3D, de dónde sacar modelos VRM y movimientos, y aviso de respetar la licencia de cada modelo.
- Créditos: modelo CC0 de VRoid Project y librerías three.js y three-vrm.

## 9. Orden de implementación

Cada fase deja la app funcionando y con los tests en verde:

1. **Base sin cambios visibles**: `behaviour.js` + `drive-2d.js` sustituyen al `Animator`; interfaz común; `avatar.js` elige renderizador por `skin.type`.
2. **VRM mínimo**: dependencias, import map y CSP, `VrmRenderer` con encuadre `half` fijo, parpadeo, labios, mirada, respiración, `hit-mask` y skin de serie.
3. **Animaciones propias**: `motion.js`, clips por estado y gestos.
4. **Emociones**: filtro, prompt, IPC y expresiones.
5. **Encuadre e importación de VRM**: `framing.js`, pestaña 3D del editor, `saveVrmSkin`, panel de licencia y miniaturas.
6. **Movimientos importados**: `.vrma`, `.fbx`, biblioteca y asignación.
7. **Cierre**: smoke ampliado, textos en 5 idiomas, capturas, README, CHANGELOG y 0.3.0.

## 10. Riesgos

- **WebGL en CI**: el smoke corre con Xvfb y SwiftShader. Si three.js no consigue contexto WebGL2 en el runner de Windows o Linux, el caso 3D del smoke se marca como omitido en ese runner (con aviso en el log) y la verificación visual se hace en local con capturas.
- **Calidad de las animaciones propias**: escritas a mano como datos. Se iteran con renders; si alguna no queda natural, se simplifica antes que entregarla rara.
- **Variedad de modelos VRM**: proporciones, expresiones y materiales cambian mucho entre modelos. Se prueba con al menos tres modelos distintos (dos CC0 de VRoid y uno VRM 1.0).
