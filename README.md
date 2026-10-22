# Waifu Desk

Una asistente de IA con forma de personaje anime que vive **flotando encima de tu escritorio**
(Windows y Linux). Haces clic en ella y le hablas por texto o por voz. Te responde el modelo
que elijas (Claude, OpenAI, OpenRouter, Gemini, Groq, Ollama, LM Studio o tu propio Hermes Agent)
usando **tu API key**.

No es un juguete: tiene herramientas para **delegar trabajo a tu agente Hermes del VPS**,
**crear y asignar tareas a tus agentes de Paperclip**, lanzar **webhooks** de tus automatizaciones
(n8n, Make, Home Assistant…), conectar cualquier **servidor MCP** y, si lo activas, **ejecutar
comandos** en tu PC (siempre con tu aprobación).

Y puedes **cambiarle la skin**: le das cualquier dibujo (archivo, portapapeles o URL), la app
**recorta el fondo con un modelo de IA entrenado para anime**, detecta ojos, boca y cuello, y la
anima (respira, parpadea, mueve la boca al hablar y gira la cabeza siguiendo el ratón).

---

## Instalar en Windows

1. Ejecuta `WaifuDesk-Setup-0.1.0.exe`. Se instala solo para tu usuario, sin permisos de
   administrador, y crea accesos en el Escritorio y en el menú Inicio.
2. El instalador no está firmado, así que Windows SmartScreen avisará: **Más información →
   Ejecutar de todos modos**.
3. La primera vez se abren los Ajustes: pega tu API key de Anthropic en **Modelos de IA** y listo.

Se desinstala desde Configuración → Aplicaciones. Tus ajustes, claves y skins se conservan en
`%APPDATA%\Waifu Desk` por si vuelves a instalar.

## Ejecutar desde el código

Necesitas **Node.js 20 o superior** (<https://nodejs.org>).

```bash
cd waifu-desk
npm install
npm start
```

### Usarla

| Acción | Resultado |
| --- | --- |
| Clic en la waifu | Abre / cierra el chat |
| Doble clic | Te escucha (se para sola cuando te callas) |
| Arrastrar | Moverla por la pantalla |
| Clic derecho | Menú: modelo, skin, tamaño, siempre encima, ajustes… |
| `Ctrl+Alt+Space` | Abrir el chat desde cualquier sitio |
| `Ctrl+Alt+V` | Hablarle desde cualquier sitio |

También vive en la bandeja del sistema. Los atajos se cambian en Ajustes → General.

### Crear el instalador

```bash
npm run dist:win         # en Windows: instalador NSIS + .zip (en dist/)
npm run dist:win:cross   # en Linux/macOS: lo mismo sin Wine (makensis nativo + icono con resedit)
npm run dist:linux       # en Linux: AppImage + .deb
```

---

## Modelos de IA

Cada **perfil** es un modelo con su clave. Cámbialos desde el selector del chat o el menú del avatar.

- **Anthropic (Claude)**: tipo «Anthropic», URL `https://api.anthropic.com`, modelo por ejemplo
  `claude-sonnet-5-5`. El botón **Cargar** pide la lista real de modelos de tu cuenta.
- **Cualquier API compatible con OpenAI**: OpenAI, OpenRouter, Groq, Gemini (endpoint OpenAI),
  Ollama, LM Studio, vLLM… Tipo «OpenAI-compatible» y la URL acabada en `/v1`.
- **Hermes Agent directo**: el perfil «Hermes Agent (VPS)» habla con Hermes como si fuera un
  modelo. En ese caso desactiva «Permitir herramientas», porque Hermes ya tiene las suyas.

Las claves se guardan **cifradas** con el almacén seguro del sistema (DPAPI en Windows,
libsecret/kwallet en Linux). Nunca salen de tu PC salvo hacia el proveedor correspondiente.

## Voz

**Dictado** (voz → texto), mediante cualquier endpoint compatible con Whisper:

- **Groq** (recomendado: rápido y con plan gratuito): `https://api.groq.com/openai/v1`, modelo
  `whisper-large-v3-turbo`.
- **OpenAI**: `https://api.openai.com/v1`, modelo `gpt-4o-mini-transcribe` o `whisper-1`.
- **Tu VPS**: [speaches](https://github.com/speaches-ai/speaches) o faster-whisper-server.

**Voz de la asistente** (texto → audio, con la boca sincronizada):

- **Voces del sistema**: gratis y sin conexión. En Windows puedes añadir voces en
  Configuración → Hora e idioma → Voz.
- **OpenAI-compatible**: OpenAI (`gpt-4o-mini-tts`) o [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI)
  en tu VPS (`docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu`, voces como `ef_dora`
  o `jf_alpha`). Gratis y con buena calidad.
- **ElevenLabs**: pon tu API key y el *Voice ID*.

Empieza a hablar por frases mientras el modelo aún está escribiendo, y no lee los bloques de código.

## Hermes Agent (en tu VPS)

La asistente tiene la herramienta `hermes_task`: cuando algo debe hacerse en el servidor (revisar
contenedores, ejecutar scripts, investigar…), se lo encarga a Hermes y te resume el resultado.

1. En el VPS, en `~/.hermes/.env`:

   ```env
   API_SERVER_ENABLED=true
   API_SERVER_KEY=una-clave-larga-y-aleatoria
   API_SERVER_HOST=127.0.0.1
   API_SERVER_PORT=8642
   ```

2. Arranca `hermes gateway` (o el contenedor `nousresearch/hermes-agent`).
3. Publícalo con tu reverse proxy en un subdominio con TLS, por ejemplo con nginx:

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:8642;
       proxy_http_version 1.1;
       proxy_buffering off;          # importante para el streaming
       proxy_read_timeout 900s;      # las tareas largas tardan
   }
   ```

   O, sin exponer nada, con un túnel SSH: `ssh -N -L 8642:127.0.0.1:8642 usuario@tu-vps`.
4. En Ajustes → Hermes y Paperclip: activa Hermes, pon la URL (`https://hermes.tudominio/v1` o
   `http://localhost:8642/v1`) y la `API_SERVER_KEY`. Pulsa **Probar conexión**.

> Hermes tiene acceso a la terminal del servidor. No lo expongas nunca sin clave ni sin TLS.

## Paperclip

Herramientas incluidas: listar agentes y proyectos, listar y ver tareas, **crear tareas
asignadas a un agente**, actualizar estado y prioridad, comentar y **despertar agentes**.

1. En Ajustes → Hermes y Paperclip, pon la URL raíz de tu Paperclip (`http://localhost:3100` o tu
   dominio; la app añade `/api` sola).
2. Si tu instancia está en modo `authenticated`, pega un token de board (Bearer). En modo
   `local_trusted` no hace falta.
3. Pulsa **Probar y listar empresas** y elige la tuya.

Ejemplos de cosas que le puedes pedir:

- «¿Qué tareas tienen pendientes mis agentes?»
- «Crea una tarea para el CTO: migrar Postgres a la 17, prioridad alta, y despiértalo.»
- «Comenta en PAP-12 que use la rama `feature/cache`.»

Las acciones que cambian cosas piden confirmación. Con «Permitir siempre» dejan de hacerlo, y desde
Automatizaciones puedes volver a activar las confirmaciones.

## Automatizaciones

- **Webhooks**: cada uno se convierte en una herramienta (`webhook_<nombre>`). Lo importante es la
  **descripción**: es lo que la IA lee para decidir cuándo usarlo y qué `payload` mandar.
- **Servidores MCP** (stdio o HTTP): conecta cualquier servidor
  [Model Context Protocol](https://modelcontextprotocol.io). Por ejemplo:
  - Archivos: comando `npx`, argumentos `-y @modelcontextprotocol/server-filesystem C:\Users\tu\Documents`
  - Paperclip vía MCP: `uvx paperclip-mcp --transport stdio` con `PAPERCLIP_BASE_URL` y `PAPERCLIP_API_KEY` en las variables.
- **Comandos en el PC** (`run_command`): PowerShell en Windows, bash en Linux. Cada comando se
  enseña y **necesita tu aprobación**; nunca se aprueba solo.

## Skins

Ajustes → Skins → **Importar un dibujo** (o clic derecho en la waifu → Skin → Importar imagen):

1. **Imagen**: abrir archivo, pegar (`Ctrl+V`), arrastrar o pegar una URL.
2. **Fondo**: si ya es un PNG transparente no hace falta nada. Si no:
   - **Recorte con IA**: usa el modelo `isnet-anime` de
     [SkyTNT/anime-segmentation](https://github.com/SkyTNT/anime-segmentation) (Apache-2.0, en la
     versión empaquetada por [rembg](https://github.com/danielgatis/rembg)). Se descarga una sola vez
     (176 MB) y corre **en local** con onnxruntime-web; no sube tu imagen a ningún sitio.
   - **Quitar color de fondo**: para fondos lisos, con tolerancia ajustable.
3. **Puntos de animación**: la app detecta la cara por el tono de piel y los ojos como huecos dentro
   de ella. Revisa y arrastra los marcadores: óvalos de los ojos (cubriendo pestañas incluidas),
   boca y cuello (por donde gira la cabeza). `Shift` al arrastrar un ojo mueve los dos en vertical;
   `Alt` al redimensionar iguala el tamaño.
4. **Guardar y usar**. La vista previa animada se actualiza en directo.

Funciona mejor con personajes **de frente y de cintura para arriba**.

### Skins con capas (máxima calidad)

Una skin es una carpeta con `skin.json` y sus imágenes, en la carpeta de datos (Ajustes → General →
Abrir carpeta de datos → `skins/`). Si además de `base` añades capas del mismo tamaño, se usan en
lugar de los efectos automáticos:

```json
{
  "name": "Mi waifu",
  "width": 800, "height": 1000,
  "files": {
    "base": "base.png",
    "eyesClosed": "eyes_closed.png",
    "mouthHalf": "mouth_half.png",
    "mouthOpen": "mouth_open.png"
  },
  "rig": {
    "eyes": [{ "x": 326, "y": 404, "w": 118, "h": 124 }, { "x": 474, "y": 404, "w": 118, "h": 124 }],
    "mouth": { "x": 400, "y": 512, "w": 40 },
    "neck": { "x": 400, "y": 575 }
  }
}
```

La skin de serie (Noa) está hecha así y se genera con `python3 tools/draw_default_skin.py`.

## Cómo está hecho

```
src/
  main/            proceso principal (Electron)
    main.js        ventanas, bandeja, atajos, protocolo app://, orquestación chat + voz
    log.js         registro de diagnóstico
    config.js      ajustes + claves cifradas (safeStorage)
    llm/           adaptadores Anthropic y OpenAI-compatible (streaming + tool use) y bucle de agente
    tools/         herramientas: básicas, Hermes, Paperclip, webhooks, cliente MCP
    voice.js       transcripción, síntesis y troceado en frases
    skins.js       skins, descarga del modelo de recorte
  preload/         puente seguro (contextIsolation + sandbox)
  renderer/
    avatar/        ventana transparente con la waifu, micrófono y reproducción con lip-sync
    chat/          panel de chat
    settings/      ajustes
    editor/        importador de skins (recorte IA, marcadores, vista previa)
    shared/        renderizador WebGL2 con malla deformable (y respaldo 2D), animador, markdown
assets/skins/default/   skin de serie en capas SVG
tools/draw_default_skin.py   genera la skin de serie
build/                  icono, script del instalador NSIS y hook que pone el icono al .exe
```

- La ventana del avatar es transparente y deja pasar los clics fuera de la silueta (en Windows con
  reenvío del ratón; en Linux recortando la forma de la ventana).
- La animación deforma una malla 40×N en la GPU: respiración, giro de cabeza alrededor del cuello,
  mandíbula; parpadeo y boca por capas o con shaders.
- Añadir una herramienta nueva es escribir un objeto `{ name, description, schema, run }` en
  `src/main/tools/` y registrarlo en `tools/index.js`.

## Notas por plataforma

- **Windows 10/11**: todo funciona tal cual.
- **Linux**: necesita un compositor para la transparencia (GNOME, KDE, Hyprland… lo traen). En X11
  sin compositor se verá un rectángulo negro. «Arrancar con el sistema» no está disponible desde la
  app: añade `waifu-desk` a tus aplicaciones de inicio.
- **Android / iOS**: pendiente. Android permite la superposición (permiso «mostrar sobre otras
  apps») y es el siguiente paso natural. iOS no deja dibujar encima de otras apps, así que allí
  sería un widget o un atajo.

## Solución de problemas

- **Algo no va**: Ajustes → General → **Ver registro de errores** (`%APPDATA%\Waifu Desk\waifu-desk.log`).
  Ahí quedan los fallos de arranque, de las APIs y de las páginas.
- **No me oye**: en Windows, Configuración → Privacidad y seguridad → Micrófono → activa «Permitir
  que las aplicaciones de escritorio accedan al micrófono». Y revisa que el dictado tenga clave en
  Ajustes → Voz.
- **No habla**: con «Voces del sistema» necesitas una voz en español instalada (Configuración →
  Hora e idioma → Voz). Prueba con el botón **Probar voz**.
- **Un atajo no funciona**: otra app lo está usando; el registro lo indica. Cámbialo en Ajustes → General.
- **No la veo**: clic en el icono de la bandeja para mostrarla u ocultarla. Si la moviste a un
  monitor que ya no está, vuelve a la esquina inferior derecha al arrancar.
- **Linux, rectángulo negro alrededor**: falta un compositor (ver Notas por plataforma).

## Privacidad

Todo se guarda en tu carpeta de datos local: ajustes, claves cifradas, conversación y skins. La
app solo se conecta a los servicios que configures, y al modelo de recorte cuando lo descargas.
