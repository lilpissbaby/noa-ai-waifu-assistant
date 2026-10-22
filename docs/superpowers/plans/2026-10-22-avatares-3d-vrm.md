# Avatares 3D (VRM) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skins 3D en formato VRM junto a las 2D, con animaciones de cuerpo, emociones de la IA, encuadre ajustable, importación de VRM y de movimientos, y entrega como 0.3.0.

**Architecture:** Un segundo renderizador (`VrmRenderer`, three.js + @pixiv/three-vrm) cumple la misma interfaz que el `SkinRenderer` 2D. Un `Behaviour` puro decide qué hace el avatar y produce señales normalizadas; cada renderizador las aplica a su manera (`drive-2d.js` reproduce exactamente la 2D actual). Las emociones se extraen del flujo de texto en el proceso principal.

**Tech Stack:** Electron 44, módulos ES sin bundler servidos por `app://`, three 0.186.1, @pixiv/three-vrm 3.5.5, @pixiv/three-vrm-animation 3.5.5, `node:test`, ESLint, smoke con Electron real bajo Xvfb.

**Spec:** `docs/superpowers/specs/2026-10-22-avatares-3d-vrm-design.md`

## Global Constraints

- Versiones fijas: `three@0.186.1`, `@pixiv/three-vrm@3.5.5`, `@pixiv/three-vrm-animation@3.5.5` (en `dependencies`).
- Sin bundler. Las páginas con 3D (`avatar.html`, `vrm-editor.html`) llevan un `<script type="importmap">` autorizado en la CSP por hash SHA-256; nada de `'unsafe-inline'` en `script-src`.
- Solo se sirven y empaquetan estos archivos de `node_modules`: `three/build/three.module.js`, `three/build/three.core.js`, `three/examples/jsm/loaders/GLTFLoader.js`, `three/examples/jsm/loaders/FBXLoader.js`, `three/examples/jsm/utils/BufferGeometryUtils.js`, `three/examples/jsm/utils/SkeletonUtils.js`, `three/examples/jsm/libs/fflate.module.js`, `three/examples/jsm/curves/NURBSCurve.js`, `three/examples/jsm/curves/NURBSUtils.js`, `@pixiv/three-vrm/lib/three-vrm.module.min.js`, `@pixiv/three-vrm-animation/lib/three-vrm-animation.module.min.js`.
- La skin 2D no cambia de aspecto ni de movimiento (test de equivalencia con el `Animator` actual).
- Todo texto visible nuevo existe en `es`, `en`, `ru`, `uk` y `zh` con las mismas variables (`test/i18n.test.mjs` lo exige).
- Prompt de sistema y descripciones para el modelo, en inglés.
- Etiquetas de emoción: `<emo:NAME>` con `NAME` ∈ `happy | angry | sad | relaxed | surprised | neutral`.
- Emoción en el avatar: subida 250 ms, mantenimiento 4000 ms, bajada 800 ms.
- Encuadre: presets `full | half | bust`; `zoom` 0,6–1,6; `yaw` −45…45°; `pitch` −15…15°; `offsetY` −0,2…0,2; FOV vertical 20°.
- Rendimiento VRM: 30 fps en reposo, 60 si `talking`, fundidos, gestos, saltito o arrastre; `pixelRatio ≤ 1.5`; sin sombras; muelles a paso fijo 1/60 s con máx. 3 subpasos; máscara de clic cada ~100 ms a ¼ de resolución.
- Tamaño máximo de un `.vrm` importado: 150 MB. De un movimiento: 30 MB.
- Mensajes de commit en español con prefijo convencional (`feat(vrm): …`), terminados con las líneas de atribución de la sesión.

## Review Focus

- **VRM 0.x de VRoid Hub/Booth** (la mayoría): deben mirar a cámara (`VRMUtils.rotateVRM0`) y animarse aunque les falten expresiones o huesos opcionales; ninguna señal puede lanzar excepción si el modelo no tiene `blink`, `aa`, `happy`, `neck`, `upperChest`… → test en Task 6 con un `vrm` simulado sin expresiones ni huesos opcionales.
- **Cambiar de skin 2D↔3D en caliente**: el canvas se sustituye, el contexto anterior se libera, el clic que atraviesa y el recorte de Linux siguen funcionando, y no se acumulan bucles de `requestAnimationFrame` → caso en el smoke de Task 6 (ida y vuelta dos veces, un solo bucle activo).
- **Archivos que no son lo que parecen**: un `.glb` sin VRM, un `.vrm` truncado, un `.fbx` que no es de Mixamo, un archivo de 200 MB → mensaje con el motivo, nada guardado → tests en Task 9 (`validateVrmFile`) y Task 10 (`mixamoBoneMap`).
- **Etiquetas de emoción raras en el flujo**: partidas en cualquier byte, al final del texto sin cerrar, dentro de código, `a < b` → tests en Task 8.
- **Skin VRM activa cuyo archivo desaparece** (borrado a mano, carpeta movida): arranca con Noa 2D y un aviso, sin bucle de errores → test en Task 6 (`loadSkinWithFallback`).

---

### Task 1: `Behaviour` + `drive-2d` sustituyen al `Animator`

**Files:**
- Create: `src/renderer/shared/behaviour.js`, `src/renderer/shared/drive-2d.js`, `test/behaviour.test.mjs`, `test/helpers/animator-v0.2.mjs` (copia literal del `Animator` actual, solo para el test de equivalencia)
- Modify: `src/renderer/shared/skin-renderer.js` (método `apply`), `eslint.config.js` si hace falta para `test/helpers`

**Interfaces:**
- Produces:
  - `class Behaviour { constructor({ random = Math.random } = {}); state: string; cursor: {x,y}|null; levelFn: (() => number)|null; fakeTalkUntil: number; blink(); trigger(name: 'greet'|'done'|'hop'); setEmotion(name: string, now: number); tick(now: number, head: [number,number]|null) → Signals }`
  - `Signals = { t, state, breath, blink, mouth, look:{x,y}, sway, tilt, lift, hop, emotion:{name,weight}, talking, events: string[] }`
    - `look` = cursor normalizado (`dx/700`, `dy/500`, recortado a ±1) suavizado con k=0,08; `sway` = `sin(t·0,55)·0,025 + sin(t·1,3)·0,008` suavizado; `tilt` = desvío de ángulo del estado (`thinking`: `0,06 + sin(t·2)·0,01`; `listening`: `sin(t·3)·0,012 − 0,04`) suavizado; `lift` = 1 en `thinking`, 0 si no, suavizado. Todos con el mismo k=0,08.
    - `hop` decae ×0,9 por tick como hoy; `trigger()` lo pone a 1 y añade el nombre a `events` del siguiente tick.
    - `talking` = `mouth > 0` o `fakeTalkUntil > now`.
  - `drive2d(signals, H) → { breath, blink, mouth, headAngle, headX, headY, bounce }` con `headAngle = sway + look.x·0,07 + tilt`, `headX = look.x·H·0,012`, `headY = look.y·H·0,006 − lift·H·0,004`, `bounce` = fórmula actual del saltito.
  - `SkinRenderer.prototype.apply(signals)` → copia `drive2d(...)` en `this.params`.

- [ ] **Step 1: Write the failing tests** en `test/behaviour.test.mjs`:
  - `drive2d(behaviour) reproduce el Animator 0.2`: con `random` sembrado igual en ambos, mismo guion de 600 ticks a 16,7 ms (cursor que se mueve, estados `idle→thinking→listening→talking→idle`, `fakeTalkUntil`, dos `bounce()`/`trigger('hop')`), `assert` de que `breath, blink, mouth, headAngle, headX, headY, bounce` coinciden con el `Animator` copiado con tolerancia 1e-9.
  - `setEmotion: sube en 250 ms, se mantiene 4 s y baja en 800 ms`: `weight` a t+125 ms ≈ 0,5 (±0,05), a t+2000 = 1, a t+4250+400 ≈ 0,5 (±0,05), a t+5100 = 0 y `name` vuelve a `'neutral'`.
  - `setEmotion('neutral')` lleva el peso a 0 en 800 ms.
  - `trigger('greet')` aparece una sola vez en `events`.
- [ ] **Step 2:** `npm test` → FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar `behaviour.js`, `drive-2d.js` y `SkinRenderer.apply`.
- [ ] **Step 4:** `npm test` → PASS; `npm run lint` limpio.
- [ ] **Step 5: Commit** `refactor(avatar): comportamiento separado del dibujo (Behaviour + drive-2d)`.

### Task 2: Interfaz común, `Stage` y uso en avatar y editor 2D

**Files:**
- Create: `src/renderer/shared/stage.js`
- Modify: `src/renderer/shared/skin-renderer.js` (`kind`, `aspect`, `headAnchorCss`, `frameInterval`, `dispose`), `src/renderer/avatar/avatar.js`, `src/renderer/editor/editor.js`
- Delete: `src/renderer/shared/animator.js`

**Interfaces:**
- Consumes: `Behaviour`, `Signals`, `SkinRenderer.apply` (Task 1).
- Produces (contrato de renderizador, lo cumplen `SkinRenderer` y `VrmRenderer`):
  - `kind: '2d'|'vrm'`, `load(skin) → Promise<skin>`, `layout(box)`, `apply(signals)`, `render(dtSeconds)`, `aspect: number`, `headAnchorCss() → [x,y]`, `alphaAtCss(x,y,r=1) → 0..255`, `shapeRects(cell=6,pad=6) → Rect[]`, `frameInterval(signals) → ms` (2D: 0 = cada rAF), `dispose()`.
  - `class Stage { constructor(renderer, behaviour); renderer; behaviour; start(); stop(); running: boolean }`: un único bucle `requestAnimationFrame`; en cada vuelta, si ha pasado `renderer.frameInterval(lastSignals)` desde el último dibujo: `signals = behaviour.tick(now, renderer.headAnchorCss())`, `renderer.apply(signals)`, `renderer.render(dt)`. Expone `window.__wd = { renderer, behaviour, stage }` en el avatar (el smoke lo usa). Se pausa con `document.visibilityState === 'hidden'` y se reanuda al volver. El listener de `webglcontextlost` (recarga) se registra en cada canvas nuevo.
  - `SkinRenderer.headAnchorCss()` = `imageToCss(rig.neck.x, rig.neck.y·0,6)` (lo que hoy usa el `Animator`); `aspect` = `skin.width / skin.height`.

- [ ] **Step 1:** Añadir a `test/behaviour.test.mjs` el test `Stage: un solo bucle aunque se llame start() dos veces` (con `requestAnimationFrame` falso en `globalThis`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `stage.js`; migrar `avatar.js` (`anim.*` → `behaviour.*`/`stage`, `desiredSize()` con `renderer.aspect`, cola del bocadillo con `headAnchorCss()`) y la vista previa del editor 2D; borrar `animator.js`.
- [ ] **Step 4:** `npm test`, `npm run lint` y `xvfb-run -a npm run smoke` → todo verde.
- [ ] **Step 5: Commit** `refactor(avatar): interfaz común de renderizador y bucle Stage`.

### Task 3: Dependencias 3D, servidas por `app://` e import maps

**Files:**
- Modify: `package.json` (`dependencies`, `build.files`), `package-lock.json`, `src/main/main.js` (`BUNDLE_ALLOWED`), `src/renderer/avatar/avatar.html`, `tools/smoke.mjs` (Linux: `--use-angle=swiftshader`)
- Create: `src/renderer/shared/vendor.js` (lista única de rutas para import maps y tests), `test/vendor.test.mjs`

**Interfaces:**
- Produces: `VENDOR_FILES: string[]` (las 11 rutas de Global Constraints, relativas a la raíz) y `IMPORT_MAP = { imports: { three, 'three/addons/', '@pixiv/three-vrm', '@pixiv/three-vrm-animation' } }` con rutas absolutas `/bundle/node_modules/…`.

- [ ] **Step 1: Write the failing tests** en `test/vendor.test.mjs`:
  - `cada archivo de VENDOR_FILES existe en node_modules`.
  - `BUNDLE_ALLOWED permite todos los VENDOR_FILES y nada más de node_modules/three o @pixiv` (leyendo el array exportado de `main.js` o duplicado en `src/main/bundle-allowed.js`, que se crea aquí para poder importarlo sin Electron).
  - `build.files incluye los VENDOR_FILES y excluye el resto de three y @pixiv`.
  - `cada página con import map lo tiene igual a IMPORT_MAP y su CSP contiene 'sha256-<hash del contenido exacto>'` (recorre `src/renderer/**/*.html`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** `npm install three@0.186.1 @pixiv/three-vrm@3.5.5 @pixiv/three-vrm-animation@3.5.5`; mover `BUNDLE_ALLOWED` a `src/main/bundle-allowed.js` con prefijos exactos; import map + hash en `avatar.html`; patrones `!node_modules/three/**`, `!node_modules/@pixiv/**` seguidos de los incluidos.
- [ ] **Step 4:** `npm test` → PASS; `npx electron-builder --linux dir --publish never` y comprobar con `npx asar list dist/linux-unpacked/resources/app.asar | grep -E "three|pixiv"` que solo aparecen las 11 rutas (más los `package.json` que electron-builder añada).
- [ ] **Step 5: Commit** `build(vrm): three.js y three-vrm servidos sin bundler`.

### Task 4: Encuadre (`framing.js`)

**Files:**
- Create: `src/renderer/shared/vrm/framing.js`, `test/framing.test.mjs`

**Interfaces:**
- Produces:
  - `DEFAULT_FRAMING = { preset: 'half', zoom: 1, yaw: 0, pitch: 0, offsetY: 0 }`; `normalizeFraming(f) → framing` (rellena y recorta a los rangos de Global Constraints).
  - `computeFraming(dims, framing, fovDeg = 20) → { aspect, height, target: [x,y,z], position: [x,y,z] }`, donde `dims = { top, chestY, hipsY, bottom, shoulderWidth }` en metros (modelo mirando a +Z).
  - Rango vertical: `full` = [bottom, top]; `half` = [hipsY − 0,08·(top − hipsY), top]; `bust` = [chestY − 0,25·(top − chestY), top]. `height = (alto del rango)·1,08 / zoom`.
  - `aspect` = `shoulderWidth·k / alto del rango` con k = 2,0 (`full`), 2,4 (`half`), 2,6 (`bust`), recortado a [0,42, 1,1].
  - `target` = centro del rango + `offsetY·height` en Y; cámara a distancia `(height/2)/tan(fov/2)` sobre +Z, girada `pitch` alrededor del eje X del objetivo. `yaw` no mueve la cámara (lo aplica el renderizador al modelo).

- [ ] **Step 1: Write the failing tests**: con `dims = { top: 1.55, chestY: 1.15, hipsY: 0.85, bottom: 0, shoulderWidth: 0.34 }`: `full` → `height ≈ 1.674`, `aspect ≈ 0.42` (recortado); `half` → rango [0,794, 1,55]; `bust` → rango [1,05, 1,55] y `aspect ≈ 1.1` (recortado); `zoom: 2` se recorta a 1,6; `pitch: 10` sube la cámara y el objetivo no cambia; `offsetY: 0.1` desplaza el objetivo `0.1·height`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (sin three; matemáticas a mano). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(vrm): cálculo de encuadre por huesos`.

### Task 5: Labios y ojos del VRM (`drive-vrm.js`, parte pura)

**Files:**
- Create: `src/renderer/shared/vrm/drive-vrm.js`, `test/drive-vrm.test.mjs`

**Interfaces:**
- Produces:
  - `mouthShapes(level, timeMs) → { aa, ih, ou, ee, oh }`: suma = `level`; `aa ≥ 0,4·level`; la vocal secundaria cambia cada 90–160 ms (duración del tramo por hash del índice del tramo, determinista).
  - `expressionWeights(signals) → { blink, aa, ih, ou, ee, oh, happy, angry, sad, relaxed, surprised }`: `blink = 0` si `happy > 0,5`.
  - `lookOffsets(signals) → { eyes:{yaw,pitch}, neck:{x,y}, head:{x,y} }` en radianes: ojos `look.x·25°`, `look.y·15°`; el 40 % del giro (`look.x·35°`, `look.y·20°`) repartido 40 % cuello / 60 % cabeza; `tilt` y `sway` del estado se suman al eje Z de la cabeza.
  - `applyToVrm(vrm, signals, state)` (con three): aplica pesos con `expressionManager?.setValue` solo si la expresión existe, mira con `vrm.lookAt` hacia un `Object3D` objetivo, y suma rotaciones a huesos normalizados solo si existen.

- [ ] **Step 1: Write the failing tests**: `mouthShapes(0, t)` todo 0; para 200 tiempos, suma = level (±1e-9) y `aa ≥ 0,4·level`; cambia de vocal secundaria entre t y t+170 ms; `expressionWeights` anula `blink` con `happy` 0,6; `applyToVrm` con un `vrm` simulado sin `expressionManager`, sin `lookAt` y con `humanoid.getNormalizedBoneNode` que devuelve `null` para todo → no lanza.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(vrm): labios, parpadeo y mirada`.

### Task 6: `VrmRenderer`, skin de serie y elección de renderizador

**Files:**
- Create: `src/renderer/shared/vrm/vrm-renderer.js`, `src/renderer/shared/vrm/hit-mask.js`, `src/renderer/shared/renderer-factory.js`, `assets/skins/noa-3d/{skin.json,model.vrm,thumb.png,LICENSE.txt}`, `test/skins.test.mjs`
- Modify: `src/main/skins.js` (`readManifest` con `type`), `src/renderer/avatar/avatar.js`, `src/renderer/avatar/avatar.css` si hace falta, `tools/automation/smoke.mjs`

**Interfaces:**
- Consumes: contrato de Task 2, `computeFraming`/`normalizeFraming` (Task 4), `applyToVrm` (Task 5), `IMPORT_MAP` (Task 3).
- Produces:
  - `class VrmRenderer` (contrato de Task 2, `kind = 'vrm'`): `WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true })`, `setPixelRatio(min(dpr, 1,5))`, luz direccional + ambiente, `PerspectiveCamera(20)`; `load(skin)` carga `skin.urls.model` con `GLTFLoader` + `VRMLoaderPlugin`, `VRMUtils.removeUnnecessaryVertices`, `VRMUtils.combineSkeletons`, `VRMUtils.rotateVRM0`, mide `dims` en pose de reposo y baja los brazos a pose A (`leftUpperArm.z = −1,2`, `rightUpperArm.z = 1,2`); `setFraming(framing)`; `frameInterval(s)` = 0 si `s.talking || s.hop > 0,01 || this.busy` y si no 1000/30; `render(dt)` llama `vrm.update` con subpasos de 1/60 (máx. 3).
  - `class HitMask { constructor(scale = 0.25, everyMs = 100); maybeCapture(glCanvas, now); alphaAt(cssX, cssY, r); rects(cell, pad) }` (captura con `drawImage` justo tras `render`).
  - `createRenderer(canvas, skin) → SkinRenderer|VrmRenderer` y `loadSkinWithFallback(canvasHost, skin, fallbackSkin, onError) → { renderer, skin }`.
  - Manifiesto (§4.1 de la spec) y `readManifest` devuelve `type` (`'2d'` por defecto).
  - Skin de serie `noa-3d`: el modelo `VRM1_Constraint_Twist_Sample.vrm` del repo de three-vrm (pixiv Inc., VRM 1.0, `allowRedistribution: true`, `modification: allowModificationRedistribution`, `creditNotation: unnecessary`); `names` en los 5 idiomas («Noa 3D»); `LICENSE.txt` con autor, URL de origen y los campos de licencia del VRM.

- [ ] **Step 1: Write the failing tests** en `test/skins.test.mjs` (con el stub de Electron y `userDir` temporal): `listSkins()` incluye `noa-3d` con `type: 'vrm'` y `urls.model` en `app://local/bundle/assets/skins/noa-3d/model.vrm`; un manifiesto sin `type` → `'2d'`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar renderizador, máscara, fábrica, skin de serie y `avatar.js` (sustituye el `<canvas>` al cambiar de `kind`, `stage.renderer = nuevo`, `dispose()` del anterior; si el VRM falla: bocadillo de error con `t('avatar.skinFailed')`, log y `noa` 2D, sin cambiar `ui.skinId`). Añadir la clave `avatar.skinFailed` en los 5 idiomas.
- [ ] **Step 4:** Ampliar el smoke: si `webgl2` existe en el avatar, `useSkin('noa-3d')`, esperar `__wd.renderer.kind === 'vrm'`, comprobar `renderer.alphaAtCss` > 40 en el ancla de la cabeza y anotar en el log el tiempo medio de `render()`; volver a `default` y a `noa-3d` otra vez, comprobando que `__wd.stage` es el mismo objeto y `running`. Si no hay `webgl2`, registrar «3D omitido: sin WebGL2». `npm test` y `xvfb-run -a npm run smoke` → verde.
- [ ] **Step 5:** Captura de verificación (`webContents.capturePage` del avatar con `noa-3d` en los 5 estados) y revisión visual.
- [ ] **Step 6: Commit** `feat(vrm): renderizador VRM y skin 3D de serie`.

### Task 7: Movimiento: clips propios, estados y gestos

**Files:**
- Create: `src/renderer/shared/vrm/motion.js`, `src/renderer/shared/vrm/clips/index.js` (y un archivo por clip: `idle.js`, `thinking.js`, `listening.js`, `working.js`, `talking.js`, `gestures.js`), `test/motion.test.mjs`
- Modify: `src/renderer/shared/vrm/vrm-renderer.js`

**Interfaces:**
- Produces:
  - Formato de clip propio: `{ name, duration, loop, bones: { [humanBoneName]: [[t, x°, y°, z°], …] }, hipsY?: [[t, metros], …] }` (rotaciones relativas a la pose A del renderizador).
  - `class Motion { constructor({ duration, loop, sample(t) → Map<bone, Quaternion>, hipsY?(t) → number }) }`; `motionFromDef(def) → Motion`; `motionFromClip(threeClip, vrm) → Motion` (para Task 10).
  - `class MotionPlayer { constructor({ random }); setLibrary({ idle: Motion[], thinking, listening, working, talking, greet, happy, talkGesture: Motion[] }); update(dt, signals) → { pose: Map<bone, Quaternion>, hipsY, busy: boolean } }`: clip del estado en bucle con fundido 0,4 s (`error` usa `idle`; dos `idle` alternan cada 20–40 s); gestos encima con fundido 0,3 s (`greet` con el suceso `greet`, `happy` con `setEmotion('happy')`, uno de `talkGesture` cada 4–8 s con `talking`); un gesto mezcla por slerp solo los huesos que define. `busy` = hay fundido o gesto en curso.
  - Clips propios (§3.2 de la spec): `idle-a`, `idle-b`, `thinking`, `listening`, `working`, `talking`, `talk-1`, `talk-2`, `talk-3`, `greet`, `happy`.
  - El suceso `done` sigue dando el saltito procedural (no lanza `happy`); se actualiza la spec en este sentido.

- [ ] **Step 1: Write the failing tests**: `motionFromDef` interpola (a mitad de dos claves de 0° y 90° en Z → 45°); en bucle, `sample(duration + 0,1) = sample(0,1)`; `MotionPlayer` cambia de `idle` a `thinking` en 0,4 s (peso a 0,2 s ≈ 0,5); `greet` solo afecta a los huesos que define; `busy` es `true` durante el gesto y `false` 0,5 s después de acabar; con `talking` durante 20 s salen entre 2 y 5 gestos con `random` sembrado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar `motion.js`, escribir los clips y conectarlo en `VrmRenderer.apply` (pose de `MotionPlayer` → huesos normalizados; después la capa procedural de `applyToVrm`).
- [ ] **Step 4:** PASS. Capturas de cada estado y gesto con `noa-3d` (script temporal de automatización, no se commitea) y ajuste de los clips hasta que las poses sean naturales; `xvfb-run -a npm run smoke` verde.
- [ ] **Step 5: Commit** `feat(vrm): animaciones de cuerpo por estado y gestos`.

### Task 8: Emociones de la IA

**Files:**
- Create: `src/main/llm/emotion.js`, `test/emotion.test.mjs`
- Modify: `src/main/llm/agent.js`, `src/main/main.js` (reenvío), `src/main/config.js` (`ui.emotions: true`), `src/renderer/avatar/avatar.js` (`avatar:emotion` → `behaviour.setEmotion`), `src/renderer/shared/vrm/vrm-renderer.js` (gesto `happy`), `src/renderer/settings/settings.js` (interruptor en Escritorio), `src/shared/i18n/locales/*.js`, `test/agent.test.mjs`, `tools/automation/mock-server.mjs`

**Interfaces:**
- Produces:
  - `EMOTIONS = ['happy','angry','sad','relaxed','surprised','neutral']`.
  - `class EmotionTagFilter { push(delta) → { text, emotions: string[] }; flush() → { text, emotions } }`: retiene un sufijo que pueda ser prefijo de `<emo:` + nombre + `>` (máx. 20 caracteres); etiqueta válida → emoción; `<emo:xyz>` → se elimina sin emitir; otro `<…` → texto intacto; dentro de un bloque abierto con ``` no filtra.
  - `stripEmotionTags(text) → string` (para historiales antiguos).
  - `EMOTION_PROMPT` (inglés), añadido por `buildSystemPrompt` cuando `cfg.ui.emotions !== false`.
  - Evento `{ type: 'emotion', name }` de `runTurn`; `main.js` lo envía como `avatar:emotion` y no lo pasa al chat.

- [ ] **Step 1: Write the failing tests** en `test/emotion.test.mjs`: `'<emo:happy>¡Hola!'` → texto `'¡Hola!'` y `['happy']`; la misma cadena troceada carácter a carácter da lo mismo; `'a < b y <div>'` intacto; `'<emo:xyz>hola'` → `'hola'`, sin emociones; dentro de ```` ```js\n<emo:sad>\n``` ```` intacto; `flush()` con `'<emo:ha'` pendiente lo devuelve como texto. En `test/agent.test.mjs`: con el servidor de prueba enviando `'<emo:happy>Hola'` en trozos, `emit` recibe texto `'Hola'`, un evento `emotion`, y el historial guarda `'Hola'`; `buildSystemPrompt` incluye `<emo:` solo si `ui.emotions` no es `false`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; el servidor simulado antepone `<emo:happy>` a la respuesta `hello` para que el smoke lo recorra.
- [ ] **Step 4:** PASS; el smoke comprueba que la respuesta del chat no contiene `<emo:` y que el avatar recibió la emoción (`__wd.behaviour.emotion.name`).
- [ ] **Step 5: Commit** `feat(emociones): la IA marca el tono y la waifu pone cara`.

### Task 9: Editor 3D: importar VRM, licencia y encuadre

**Files:**
- Create: `src/renderer/vrm-editor/{vrm-editor.html,vrm-editor.css,vrm-editor.js}`, `src/main/vrm-files.js`, `test/vrm-files.test.mjs`
- Modify: `src/main/main.js` (ventana `vrm-editor`, IPC), `src/main/skins.js` (`saveVrmSkin`, `deleteSkin` igual), `src/renderer/settings/settings.js` (tarjeta «Importar VRM» y «Ajustar» según `type`), `src/main/main.js` menú del avatar/bandeja «Importar VRM…», `src/shared/i18n/locales/*.js`, `tools/automation/smoke.mjs` (recorre la ventana en los 5 idiomas)

**Interfaces:**
- Produces:
  - `validateVrmFile(path) → { ok: true, version: '0'|'1', meta } | { ok: false, reason: 'tooBig'|'notGlb'|'notVrm'|'truncated' }` (lee la cabecera GLB y el chunk JSON sin three; `meta` = campos de licencia de `VRMC_vrm.meta` o `VRM.meta`).
  - IPC: `skin:open-vrm` → diálogo, valida, copia a `userData/tmp/<uid>.vrm` → `{ tmpId, url, name, version, meta } | { error }`; `skin:fetch-vrm(url)` → igual descargando (límite 150 MB); `skin:save-vrm({ id?, tmpId?, name, framing, thumb })` → manifiesto; los temporales se borran al guardar y al arrancar.
  - Página `vrm-editor`: vista previa con `VrmRenderer` real; presets y deslizadores de encuadre; botones de estados, emociones y gestos; panel de licencia (`meta`); nombre; «Guardar y usar» / «Guardar»; con `?id=` edita una existente (solo encuadre y nombre).
  - `VrmRenderer.snapshot(width = 200, height = 260) → dataURL` para la miniatura.

- [ ] **Step 1: Write the failing tests** en `test/vrm-files.test.mjs` (GLB construidos en el test): VRM 1.0 válido → `ok`, `version: '1'` y `meta.allowRedistribution`; VRM 0.x → `version: '0'` y `meta.licenseName`; GLB sin extensión VRM → `notVrm`; texto plano → `notGlb`; cabecera que declara más bytes de los que hay → `truncated`; archivo de 150 MB + 1 byte (sparse con `ftruncate`) → `tooBig`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar validación, IPC, página y enlaces desde Ajustes, menú y bandeja; textos en 5 idiomas.
- [ ] **Step 4:** PASS; smoke recorre `vrm-editor` en los 5 idiomas sin claves sin traducir ni errores, abriendo `noa-3d` con `?id=noa-3d` en modo solo lectura de licencia (las de serie no se guardan: botón «Duplicar como skin propia»).
- [ ] **Step 5: Commit** `feat(vrm): editor 3D con importación, licencia y encuadre`.

### Task 10: Movimientos importados (`.vrma` y Mixamo)

**Files:**
- Create: `src/renderer/shared/vrm/import-clip.js`, `src/renderer/shared/vrm/mixamo-map.js`, `src/main/motions.js`, `test/mixamo-map.test.mjs`, `test/motions.test.mjs`
- Modify: `src/renderer/vrm-editor/*` (sección «Movimientos»), `src/main/main.js` (IPC), `src/main/config.js` (`motions.assign`), `src/renderer/shared/vrm/vrm-renderer.js` (biblioteca con asignados), `src/shared/i18n/locales/*.js`

**Interfaces:**
- Consumes: `Motion`, `motionFromClip`, `MotionPlayer.setLibrary` (Task 7).
- Produces:
  - `MIXAMO_VRM_RIG_MAP` (mapa del ejemplo oficial de three-vrm) y `mixamoBoneMap(boneNames[]) → { map, missing: string[], recognized: boolean }` (`recognized` = hay `mixamorig:Hips` y al menos 10 huesos del mapa).
  - `loadMotionFile(url, format, vrm) → Motion` (`vrma`: `GLTFLoader` + `VRMAnimationLoaderPlugin` + `createVRMAnimationClip`; `fbx`: `FBXLoader` + retarget del ejemplo oficial; descarta traslación X/Z de la cadera y conserva Y relativa al primer fotograma).
  - `motions.js`: `listMotions()`, `importMotion(srcPath) → entry`, `updateMotion(id, { duration, missingBones })`, `deleteMotion(id)` sobre `userData/motions/motions.json` (`[{ id, name, file, format, duration, missingBones }]`); límite 30 MB.
  - Config: `motions.assign = { idle: null, thinking: null, listening: null, working: null, talking: null, greet: null, happy: null, talkGesture: [] }`.
  - IPC: `skin:motions-list`, `skin:motion-import`, `skin:motion-update`, `skin:motion-delete`.
  - Si un movimiento asignado no existe o no carga, se usa el propio y se registra un aviso.

- [ ] **Step 1: Write the failing tests**: `mixamoBoneMap` con los nombres del esqueleto de Mixamo → `recognized: true`, `missing: []`; sin `mixamorig:Hips` → `recognized: false`; con 3 huesos de dedos menos → `missing` los lista. `motions.test.mjs`: importar copia el archivo y añade la entrada; `deleteMotion` borra archivo y entrada y deja de estar en `motions.assign`; un archivo > 30 MB → error `tooBig`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar y conectar en el editor (importar, probar sobre la vista previa, asignar a estado o gesto, borrar). Probar a mano con `test.vrma` del repo de three-vrm (no se incluye en el repo de la app).
- [ ] **Step 4:** PASS; smoke verde.
- [ ] **Step 5: Commit** `feat(vrm): importar movimientos .vrma y de Mixamo`.

### Task 11: Cierre y versión 0.3.0

**Files:**
- Modify: `tools/automation/screenshots.mjs` (captura con `noa-3d`), `docs/screenshots/*`, `README.md`, `README.en.md`, `CHANGELOG.md`, `package.json` (`version: 0.3.0`), `docs/superpowers/specs/2026-10-22-avatares-3d-vrm-design.md` (desviaciones: skin de serie, editor en ventana propia, `done` sin gesto `happy`)

- [ ] **Step 1:** `npm test`, `npm run lint`, `xvfb-run -a npm run smoke` → verde.
- [ ] **Step 2:** `xvfb-run -a npm run screenshots` y revisar las capturas.
- [ ] **Step 3:** README (es/en): skins 3D, de dónde sacar VRM y movimientos, respetar licencias, créditos (modelo de pixiv, three.js, three-vrm). CHANGELOG 0.3.0.
- [ ] **Step 4:** `npm run dist:linux` termina y el AppImage arranca con `noa-3d` en Xvfb (captura).
- [ ] **Step 5: Commit** `chore(release): 0.3.0` y push a `main` (el workflow crea la release).
