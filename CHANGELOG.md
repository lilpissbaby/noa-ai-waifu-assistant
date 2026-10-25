# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen
[SemVer](https://semver.org/lang/es/). El workflow de releases publica el apartado de cada versión como notas de
la release.

## [0.4.0] - 2026-10-23

### Añadido

- **Personajes**: varios a la vez, cada uno con su forma de ser, contexto, saludo, ejemplos de diálogo,
  instrucciones extra, voz y skin. Pestaña nueva en Ajustes, submenú «Personaje» en el menú de Noa y en la
  bandeja, y herramientas para cambiarlo hablando («cámbiate a Rin», «sé más seria»). Plantillas (profesional,
  alegre, tsundere, kuudere, dulce, sarcástica y romántica) en los cinco idiomas. La personalidad de 0.3 se
  convierte sola en el primer personaje.
- **Filtros de contenido** por personaje (lenguaje, violencia, política y religión, romance y contenido
  sexual) y **modo +18** que hay que desbloquear en Ajustes. Límites fijos que ningún ajuste quita: personajes
  adultos, nada sexual con menores ni con personas reales, nada de autolesiones ni de ayudar a hacer daño. Aviso
  de que Claude y OpenAI no generan contenido explícito aunque se active.
- **Tarjetas de SillyTavern** (`.png` V2/V3 o `.json`), con «Crear skin 2D con su imagen».
- **Azure OpenAI**: perfil nuevo (cabecera `api-key`), política de contenido elegida en cada petición según el
  personaje (`x-policy-id`), mensaje claro cuando el filtro de Azure bloquea algo y un Terraform en
  `docs/azure/content-filters` que crea las políticas.
- **Voces locales Piper**: neuronales, gratuitas y sin conexión. El motor (espeak-ng en WebAssembly, GPL) se
  descarga una vez y se comprueba; las voces se instalan desde el catálogo de rhasspy/piper-voices (filtrado por
  idioma, con comprobación md5) o se importan (`.onnx` + `.onnx.json` o `.zip`). Cada voz enseña su licencia,
  y cada personaje puede tener la suya.
- **Productividad** (pestaña nueva en Ajustes):
  - Recordatorios y temporizadores, también repetitivos, con aviso de los perdidos al abrir la app.
  - Avisos en el bocadillo y en el chat, con notificación y voz opcionales.
  - Memoria sobre ti y notas en Markdown.
  - «Mira esto» (`Ctrl+Alt+S`): captura la pantalla sin la waifu ni el chat y se la pasa al modelo.
  - Acciones rápidas (`Ctrl+Alt+Q`) sobre el texto copiado: traducir, resumir, corregir, explicar y
    responder, editables y ampliables.
  - Archivos: adjuntar imágenes, texto, PDF y Word al chat (arrastrando o pegando), y leer, buscar y escribir
    (con permiso) en las carpetas que autorices.
  - Agenda con enlaces iCal o archivos `.ics` (recurrencias y zonas horarias, también las de Outlook) y resumen
    diario a la hora que elijas.
  - Leer páginas web y buscar con SearXNG, Brave Search o Tavily.
  - Avisos cuando una tarea de Paperclip creada o comentada desde la app termina, se bloquea o pasa a revisión,
    y tareas de Hermes en segundo plano que avisan al acabar.
- **Imágenes en el chat** con los modelos que ven (Anthropic y compatibles con OpenAI), con miniaturas en el
  chat; opción «Puede ver imágenes» en cada perfil.
- **Avatares VTuber (Live2D)**: modelos Cubism 3, 4 y 5 (los de VTube Studio, Booth o nizima) como skin. Se
  mueven como en VTube Studio con su `.vtube.json` (rangos, suavizado, respiración y expresiones) o con los
  parámetros estándar de Cubism; caras según la emoción, saludo y encuadre. El Cubism Core (propietario de
  Live2D) se descarga del SDK oficial 5-r.4 tras aceptar su licencia, o se importa. El Core de Cubism 5.3
  (SDK 5-r.5) y los modelos exportados para Cubism 5.3 aún no son compatibles con el motor.
- **Editor de modelos 3D y VTuber**: el editor 3D gana el modo Live2D (condiciones del modelo, configuración
  de VTube Studio, encuadre, caras por emoción y deslizadores de parámetros).
- Capturas nuevas en el README: estados Live2D, editor Live2D, un recordatorio y las pestañas Personajes,
  Productividad y voces Piper.

### Cambiado

- El nombre y la personalidad pasan de Ajustes → General a Ajustes → Personajes.
- pixi.js y el motor de Live2D se cargan como scripts clásicos solo cuando la skin es Live2D, sin tocar la CSP
  (el diseño preveía el *import map*, pero su versión ESM necesita `unsafe-eval`).
- Los `.zip` se leen con `node:zlib` en lugar de fflate (así se rechazan los enlaces simbólicos); el diseño
  preveía fflate.
- En Linux, «Mira esto» oculta un instante las ventanas de Noa para que no salgan en la captura (allí la
  opacidad no se puede cambiar).
- Un `null` en un ajuste de lista la sustituye (lo usa «Restaurar las de serie» de las acciones rápidas).
- La prueba de humo cubre las pestañas nuevas en los cinco idiomas, el cambio de personaje, un recordatorio, la
  captura de pantalla, adjuntos, una acción rápida, la agenda, la web, los avisos de agentes, una voz Piper real
  que mueve la boca y un modelo Live2D de ejemplo (en el CI).
- El CI enseña los fallos de los tests y de la prueba de humo como anotaciones de la ejecución.

### Corregido

- `clipboard_read` y `clipboard_write` fallaban con Electron 44 (el portapapeles ahora es asíncrono).
- «Probar voz» usaba un nombre de asistente que ya no existía.

### Seguridad

- `app://local/user/` solo sirve las carpetas de contenido (skins, voces, adjuntos…), no los ajustes ni la
  conversación.
- Importaciones de `.zip` y carpetas sin rutas fuera ni enlaces simbólicos, con límites de tamaño y de número
  de archivos; descargas por HTTPS con tamaño limitado y suma comprobada cuando la fuente la publica.
- Archivos solo dentro de las carpetas autorizadas (resolviendo enlaces), escritura con confirmación, y
  permiso antes de capturar la pantalla o leer direcciones de la red local.

## [0.3.0] - 2026-10-22

### Añadido

- **Skins 3D (VRM)**: importa modelos VRM 0.x y 1.0 de VRoid Hub, Booth o VRoid Studio (archivo o enlace
  directo, hasta 150 MB). Renderizador con three.js y three-vrm: materiales toon, física de pelo y ropa,
  parpadeo, labios sincronizados con la voz, mirada al cursor y respiración.
- **Animaciones de cuerpo**: una pose por estado (reposo con dos variantes, pensando con la mano en la barbilla,
  escuchando, trabajando, hablando) con fundidos, gestos al hablar, saludo al abrir el chat y alegría.
- **Caras según la IA**: el modelo marca el tono con etiquetas ocultas (`<emo:happy>`…) que se quitan del chat,
  de la voz y del historial, y la waifu 3D pone esa cara. Se puede desactivar en Ajustes → General.
- **Editor 3D**: licencia declarada por el modelo, encuadre (cuerpo entero, medio cuerpo, busto, zoom, giro,
  cámara y altura), prueba de estados, caras y gestos, y miniatura automática.
- **Movimientos importados**: animaciones `.vrma` y `.fbx` de Mixamo asignables a cada estado o gesto.
- Skin 3D de serie **Noa 3D** (modelo de ejemplo de pixiv con licencia que permite redistribuirlo).
- Captura de la skin 3D y del editor 3D en el README.

### Cambiado

- El comportamiento del avatar (respiración, parpadeo, boca, mirada, saltito) se separa del dibujo: la skin 2D
  se mueve exactamente igual que antes (hay un test que lo compara con la versión 0.2).
- La prueba de humo usa WebGL por software (SwiftShader) en Linux, carga la skin 3D, va y vuelve entre 2D y 3D,
  importa un VRM de principio a fin y comprueba que las etiquetas de emoción no llegan al chat.

## [0.2.0] - 2026-10-22

Primera versión publicada en GitHub.

### Añadido

- **Interfaz en cinco idiomas**: español, inglés, ruso, ucraniano y chino simplificado. Coge el idioma del
  sistema y se cambia al momento desde Ajustes → General o desde el menú de Noa (clic derecho → Idioma):
  ventanas, menús de la bandeja, diálogos de confirmación, avisos y errores.
- **Idioma de las respuestas**: por defecto el de la interfaz; se puede fijar otro.
- La voz del sistema elige una voz del idioma de la respuesta, y el troceado en frases entiende la puntuación
  china (`。！？`).
- Al cambiar de idioma, la personalidad por defecto y el idioma del dictado también cambian (si no los has
  editado).
- **Instalador de Windows multilingüe** (los mismos cinco idiomas, según el del sistema).
- Nombre traducible de las skins (`names` en `skin.json`).
- Número de versión al pie de Ajustes → General.
- Tests unitarios (`npm test`), ESLint (`npm run lint`) y una prueba de humo que arranca la app real en los
  cinco idiomas y hace una conversación con herramientas contra un servidor simulado (`npm run smoke`).
- CI en GitHub Actions (Linux y Windows) y releases automáticas con instalador y `.zip` de Windows, AppImage y
  `.deb` de Linux, y sumas SHA-256.
- Capturas del README generadas con la app (`npm run screenshots`).

### Cambiado

- El prompt de sistema y las descripciones de las herramientas pasan a inglés; las respuestas siguen saliendo
  en el idioma elegido.
- `npm run dist:win` genera el instalador con `makensis` en cualquier sistema (ya no hace falta
  `dist:win:cross`). El desinstalador pasa a llamarse `Uninstall Waifu Desk.exe`; al actualizar se borra el
  anterior.
- Los archivos de Linux se llaman `WaifuDesk-<versión>-linux-<arch>` (sin espacios).

### Corregido

- Las miniaturas de las skins se salían de su tarjeta en Ajustes → Skins.
- Al mover la tolerancia del recorte por color se volvía a recortar aunque el último recorte fuera con IA.

## [0.1.0] - 2026-10-20

Prueba de concepto (solo en español).

- Avatar flotante y transparente con renderizador WebGL2 (respiración, parpadeo, giro de cabeza, lip-sync) y
  respaldo Canvas2D. Skin de serie «Noa» dibujada en SVG por capas.
- Chat por texto y voz con Claude (Messages API) o cualquier API compatible con OpenAI, con streaming y
  herramientas.
- Herramientas: Hermes Agent, Paperclip, webhooks, cliente MCP, comandos con aprobación, portapapeles,
  enlaces y notificaciones.
- Voz: dictado Whisper con parada por silencio; síntesis con voces del sistema, OpenAI-compatible o ElevenLabs.
- Editor de skins: importar desde archivo, portapapeles o URL, recorte con `isnet-anime` en local o por color,
  autodetección de ojos, boca y cuello y vista previa animada.
- Instalador NSIS por usuario para Windows y paquetes AppImage y `.deb` para Linux.

[0.2.0]: https://github.com/lilpissbaby/noa-ai-waifu-assistant/releases/tag/v0.2.0
[0.1.0]: https://github.com/lilpissbaby/noa-ai-waifu-assistant/commit/5000292
