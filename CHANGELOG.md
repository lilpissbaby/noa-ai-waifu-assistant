# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen
[SemVer](https://semver.org/lang/es/). El workflow de releases publica el apartado de cada versión como notas de
la release.

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
