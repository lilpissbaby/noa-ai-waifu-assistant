<div align="center">

# Noa · Waifu Desk

**Una asistente de IA con forma de personaje anime que vive flotando encima de tu escritorio.**
Le hablas por texto o por voz y te responde Claude (o el modelo que elijas). Te recuerda cosas, ve tu
pantalla, lee tus documentos y tu agenda, delega trabajo a tu agente Hermes del VPS, crea y asigna tareas a tus
agentes de Paperclip y te avisa cuando terminan.

[![CI](https://github.com/lilpissbaby/noa-ai-waifu-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/lilpissbaby/noa-ai-waifu-assistant/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lilpissbaby/noa-ai-waifu-assistant?sort=semver&label=descargar)](https://github.com/lilpissbaby/noa-ai-waifu-assistant/releases/latest)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-ff4f9a)](LICENSE)
![Windows y Linux](https://img.shields.io/badge/Windows%20%C2%B7%20Linux-b69cff)

Español · [English](README.en.md) — la app está en español, inglés, ruso, ucraniano y chino.

![Noa en el escritorio: chat con Paperclip y Hermes](docs/screenshots/desktop.jpg)

</div>

## Qué hace

- **Vive en el escritorio**: transparente, siempre encima y sin ventana que abrir. Respira, parpadea, mueve la
  boca al hablar y gira la cabeza siguiendo el ratón. Clic para el chat, doble clic para hablarle.
- **Cualquier modelo**: Claude con tu API key, Azure OpenAI o cualquier API compatible con OpenAI (OpenAI,
  OpenRouter, Groq, Gemini, Ollama, LM Studio o el propio Hermes). Streaming, herramientas e imágenes. Las claves
  se guardan cifradas.
- **Personajes**: varios, cada uno con su forma de ser, su voz y su skin, y filtros de contenido por tema
  (incluido un modo +18 con límites que no se pueden quitar). Plantillas y tarjetas de SillyTavern.
- **Voz**: dictado con Whisper (Groq tiene plan gratuito) que se para solo cuando te callas, y respuestas
  habladas con la boca sincronizada: voces locales **Piper** (gratis, sin conexión y en decenas de idiomas),
  voces del sistema, OpenAI/Kokoro o ElevenLabs.
- **Productividad**: recordatorios y temporizadores, memoria y notas, «mira esto» (ve tu pantalla), acciones
  rápidas sobre lo que copias, archivos, PDF y Word, agenda con resumen diario, leer y buscar en la web.
- **Hermes Agent**: le encarga a tu agente del VPS lo que deba hacerse en el servidor, también en segundo plano.
- **Paperclip**: lista agentes y proyectos, crea, asigna y comenta tareas, despierta agentes y te avisa cuando
  una tarea termina o se bloquea.
- **Automatizaciones**: webhooks (n8n, Make, Home Assistant…), cualquier servidor **MCP** y comandos en tu PC,
  estos siempre con tu aprobación.
- **Skins 2D**: le das cualquier dibujo y recorta el fondo con un modelo de IA para anime, en local. Coloca sola
  ojos, boca y cuello, y tú los ajustas con la vista previa animada.
- **Skins 3D (VRM)**: importa modelos de VRoid Hub, Booth o VRoid Studio. Se mueve según lo que hace (piensa con
  la mano en la barbilla, teclea, saluda, gesticula al hablar), pone caras según el tono de la respuesta y
  puedes añadirle movimientos `.vrma` o de Mixamo.
- **Avatares VTuber (Live2D)**: los modelos de VTube Studio, Booth o nizima, que se mueven con su `.vtube.json`.
- **Cinco idiomas**: español, English, Русский, Українська y 中文. Coge el del sistema y se cambia al vuelo.

## Descargar

En **[Releases](https://github.com/lilpissbaby/noa-ai-waifu-assistant/releases/latest)** están los ejecutables
de la última versión, compilados por GitHub Actions:

| Sistema | Archivo | Cómo se instala |
| --- | --- | --- |
| Windows 10/11 | `WaifuDesk-Setup-X.Y.Z.exe` | Doble clic. Se instala solo para tu usuario, sin admin. |
| Windows (portable) | `WaifuDesk-X.Y.Z-win-x64.zip` | Descomprime y abre `Waifu Desk.exe`. |
| Linux | `WaifuDesk-X.Y.Z-linux-x86_64.AppImage` | `chmod +x` y ejecútalo. |
| Debian / Ubuntu | `WaifuDesk-X.Y.Z-linux-amd64.deb` | `sudo apt install ./WaifuDesk-X.Y.Z-linux-amd64.deb` |

- El instalador de Windows no está firmado, así que SmartScreen avisará: **Más información → Ejecutar de todos modos**.
- Si tenías la PoC 0.1.0, instala encima: usa la misma carpeta y conserva tus ajustes, claves y skins
  (`%APPDATA%\Waifu Desk`).
- Cada release trae `SHA256SUMS.txt` para comprobar las descargas.

## Primeros pasos

Para empezar solo hace falta **la clave de Claude**. Todo se configura en **Ajustes** (clic derecho en Noa →
Ajustes, o desde el icono de la bandeja). No hay botón de guardar: cada cambio se guarda al momento.

| Para qué | Clave | Dónde se saca | Dónde va |
| --- | --- | --- | --- |
| Que responda | API key de Anthropic (`sk-ant-…`) | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | Modelos de IA → Claude Sonnet → API key |
| Hablarle | API key de Groq | [console.groq.com](https://console.groq.com) → API Keys | Voz → Dictado → API key |
| Hermes | Una clave que inventas tú | `openssl rand -hex 32` en el VPS | Hermes y Paperclip → API_SERVER_KEY |
| Paperclip | Token de board, o ninguno | `paperclipai token board create` | Hermes y Paperclip → Token |

La API de Anthropic se paga aparte de la suscripción de claude.ai. Si no quieres recargar saldo, puedes añadir
un perfil gratuito (Gemini o Groq) en **Modelos de IA → Añadir perfil**.

### Usarla

| Acción | Resultado |
| --- | --- |
| Clic en la waifu | Abre o cierra el chat |
| Doble clic | Te escucha (se para sola cuando te callas) |
| Arrastrar | La mueves por la pantalla |
| Clic derecho | Menú: modelo, skin, tamaño, idioma, siempre encima, ajustes… |
| `Ctrl+Alt+Space` | Abre el chat desde cualquier sitio |
| `Ctrl+Alt+V` | Le hablas desde cualquier sitio |
| `Ctrl+Alt+S` | «Mira esto»: captura la pantalla y te la deja adjunta en el chat |
| `Ctrl+Alt+Q` | Acciones rápidas sobre el texto copiado: traducir, resumir, corregir, explicar, responder |
| Arrastrar archivos al chat | Imágenes, texto, código, PDF y Word como adjuntos (también pegando) |

Los atajos se cambian en Ajustes → General.

## Capturas

**Estados**: en reposo, escuchando, pensando, trabajando con una herramienta y hablando.

![Estados del avatar](docs/screenshots/states.jpg)

**Skin 3D (VRM)**: reposo, pensando, trabajando, hablando y dos caras que pone según el tono de la respuesta.

![Estados de la skin 3D](docs/screenshots/states-3d.jpg)

**Avatar VTuber (Live2D)** con Hiyori, el modelo de ejemplo de Live2D: reposo, pensando, hablando, alegre y
siguiendo el ratón.

![Estados de la skin Live2D](docs/screenshots/states-live2d.jpg)

**Avisos**: un recordatorio sale en el bocadillo y en el chat, como notificación y, si quieres, en voz alta.

![Un recordatorio en el bocadillo y en el chat](docs/screenshots/reminder.jpg)

**La misma petición en los cinco idiomas.** La interfaz y la respuesta siguen al idioma elegido.

![Chat en español, inglés, ruso, ucraniano y chino](docs/screenshots/languages.jpg)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/settings-general.png" alt="Ajustes: general e idioma" /><br /><sub>General: idioma de la interfaz y de las respuestas, y escritorio.</sub></td>
    <td width="50%"><img src="docs/screenshots/settings-personas.png" alt="Ajustes: personajes" /><br /><sub>Personajes: forma de ser, voz, skin y filtros de cada uno.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-models.png" alt="Ajustes: modelos de IA" /><br /><sub>Modelos de IA: un perfil por proveedor, con su clave cifrada.</sub></td>
    <td><img src="docs/screenshots/settings-productivity.png" alt="Ajustes: productividad" /><br /><sub>Productividad: avisos, recordatorios, agenda, memoria, carpetas y web.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-voice.png" alt="Ajustes: voz" /><br /><sub>Voz: dictado con Whisper y voz de la asistente.</sub></td>
    <td><img src="docs/screenshots/settings-voice-piper.png" alt="Ajustes: voces Piper" /><br /><sub>Voces locales Piper: instaladas, importar y catálogo por idioma.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-connectors.png" alt="Ajustes: Hermes y Paperclip" /><br /><sub>Hermes y Paperclip, con prueba de conexión.</sub></td>
    <td><img src="docs/screenshots/settings-automations.png" alt="Ajustes: automatizaciones" /><br /><sub>Automatizaciones: comandos, webhooks y servidores MCP.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-skins.png" alt="Ajustes: skins" /><br /><sub>Skins: la de serie y las que importes (2D, 3D y VTuber).</sub></td>
    <td></td>
  </tr>
</table>

**Editor de skins**: recorte del fondo, marcadores de ojos, boca y cuello, y vista previa animada.

![Editor de skins](docs/screenshots/skin-editor.png)

**Editor 3D**: licencia del modelo, encuadre, prueba de estados, caras y gestos, y movimientos importados.

![Editor de skins 3D](docs/screenshots/vrm-editor.png)

**Editor de modelos VTuber**: condiciones del modelo, configuración de VTube Studio, encuadre, estados, caras y
deslizadores de parámetros.

![Editor de modelos Live2D](docs/screenshots/live2d-editor.png)

Las capturas se generan con la app de verdad y un servidor simulado: `npm run screenshots` (ver
[Desarrollo](#desarrollo)).

---

## Idiomas

La interfaz está en **español, inglés, ruso, ucraniano y chino simplificado**. Por defecto usa el idioma del
sistema (inglés si no es ninguno de esos). Se cambia en **Ajustes → General → Idioma de la interfaz** o desde el
clic derecho en Noa → **Idioma**, y se aplica al momento en todas las ventanas, los menús y los diálogos.

- **Idioma de las respuestas**: vacío = el de la interfaz. Puedes escribir otro (por ejemplo «English») para
  que te responda en ese idioma con la interfaz en español.
- Al cambiar de idioma, la personalidad por defecto y el idioma del dictado también cambian, salvo que los hayas
  editado.
- El instalador de Windows también sale en el idioma del sistema.

**Añadir un idioma**: copia `src/shared/i18n/locales/en.js`, tradúcelo y regístralo en
`src/shared/i18n/index.js` (`SUPPORTED` y `LANGUAGES`). `npm test` comprueba que no falte ninguna clave ni
variable, y `npm run smoke` recorre todas las ventanas buscando textos sin traducir.

## Modelos de IA

Cada **perfil** es un modelo con su clave. Se cambian desde el selector del chat o el menú del avatar.

- **Anthropic (Claude)**: tipo «Anthropic», URL `https://api.anthropic.com`, modelo por ejemplo
  `claude-sonnet-5-5`. El botón **Cargar** pide la lista de modelos de tu cuenta.
- **Cualquier API compatible con OpenAI**: OpenAI, OpenRouter, Groq, Gemini (endpoint OpenAI), Ollama, LM
  Studio, vLLM… Tipo «Compatible con OpenAI» y la URL acabada en `/v1`.
- **Azure OpenAI**: perfil «Azure OpenAI», URL `https://RECURSO.openai.azure.com/openai/v1`, el nombre del
  despliegue como modelo y la clave del recurso. Puede elegir en cada mensaje una política de contenido según
  el personaje (ver [Personajes](#personajes)).
- **Hermes Agent directo**: el perfil «Hermes Agent (VPS)» habla con Hermes como si fuera un modelo. Desactiva
  «Permitir herramientas», porque Hermes ya tiene las suyas.
- **Visión**: con los modelos que ven imágenes puedes adjuntarlas, y Noa puede mirar tu pantalla. Si el modelo
  no ve, desmarca «Puede ver imágenes» en su perfil.

Las claves se guardan **cifradas** con el almacén del sistema (DPAPI en Windows, libsecret o KWallet en Linux)
y solo salen de tu PC hacia el proveedor correspondiente.

## Personajes

Ajustes → **Personajes**. Cada personaje tiene su forma de ser, contexto y relación, saludo, ejemplos de
diálogo, instrucciones extra y, si quieres, su voz y su skin. Se cambian desde el menú de Noa (**Personaje ▸**),
desde Ajustes o pidiéndoselo: «cámbiate a Rin», «a partir de ahora sé más seria».

- **Plantillas**: profesional, alegre, tsundere, kuudere, dulce, sarcástica y romántica.
- **Tarjetas de SillyTavern**: importa la tarjeta `.png` (V2 o V3) o `.json`. Con su imagen puedes crear una
  skin 2D en un clic.
- **Filtros de contenido**, por personaje (en negrita, el de serie):

  | Tema | Niveles |
  | --- | --- |
  | Lenguaje fuerte | evitar · **moderado** · libre |
  | Violencia y temas duros | evitar · **moderado** · libre |
  | Política y religión | **neutral** · con opinión |
  | Romance y coqueteo | no · **suave** · sí |
  | Contenido sexual | **no** · insinuante (+18) · explícito (+18) |

  Si se lo pides hablando, puede endurecer sus filtros sin preguntar; para relajarlos te pide confirmación.

### Contenido +18

Los niveles «insinuante» y «explícito» no se aplican hasta que los **desbloqueas** en Ajustes → Personajes,
confirmando que eres mayor de edad y que ese contenido es legal donde vives. Se puede volver a bloquear.

- **Límites fijos**, siempre activos y sin ajuste que los quite: todos los personajes de cualquier contenido
  romántico o sexual son adultos; nada sexual con menores, con personajes que lo parezcan ni con personas
  reales; nada de fomentar autolesiones ni ayudar a hacer daño real.
- **Depende del proveedor**: Claude (Anthropic) y OpenAI no generan contenido sexual explícito aunque lo
  desbloquees. Funciona con modelos locales (Ollama, LM Studio) o con servicios que lo permitan; Azure OpenAI
  solo lo hace con el filtro modificado que Microsoft aprueba a petición.

### Azure OpenAI y sus políticas de contenido

Azure filtra por su cuenta además de lo que diga la app. En
[`docs/azure/content-filters`](docs/azure/content-filters/README.md) hay un **Terraform** que crea tres
políticas en tu recurso (`waifudesk-strict`, `waifudesk-standard` y `waifudesk-relaxed`, más una sin filtros
comentada para quien tenga la aprobación de Microsoft). En el perfil de Azure, con «Según los filtros del
personaje», la app manda en cada petición la política que encaja con el personaje activo (cabecera
`x-policy-id`). Si Azure bloquea algo, el chat dice qué categoría lo ha bloqueado.

## Voz

**Dictado** (voz → texto), con cualquier endpoint compatible con Whisper:

- **Groq** (recomendado: rápido y con plan gratuito): `https://api.groq.com/openai/v1`, modelo `whisper-large-v3-turbo`.
- **OpenAI**: `https://api.openai.com/v1`, modelo `gpt-4o-mini-transcribe` o `whisper-1`.
- **Tu VPS**: [speaches](https://github.com/speaches-ai/speaches) o faster-whisper-server.

**Voz de la asistente** (texto → audio, con la boca sincronizada):

- **Voces locales (Piper)**: voces neuronales gratuitas que suenan naturales y funcionan **sin conexión**, en
  decenas de idiomas. La primera vez se descarga su motor (unos 9 MB, espeak-ng en WebAssembly, licencia GPL)
  y luego eliges voces del **catálogo** de [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)
  (filtrado por el idioma de las respuestas) o **importas** las tuyas: `.onnx` con su `.onnx.json`, o un
  `.zip` con una o varias voces (hasta 300 MB por voz). **Cada voz tiene su licencia** (la app la enseña al
  lado y está en su `MODEL_CARD`): muchas son CC BY 4.0, CC0 o MIT, pero revisa la de la que elijas.
- **Voces del sistema**: gratis y sin conexión. Elige sola una voz del idioma de la respuesta. En Windows se
  añaden voces en Configuración → Hora e idioma → Voz.
- **Compatible con OpenAI**: OpenAI (`gpt-4o-mini-tts`) o [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI)
  en tu VPS (`docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu`, voces como `ef_dora` o `jf_alpha`).
- **ElevenLabs**: tu API key y el *Voice ID*.

Empieza a hablar por frases mientras el modelo aún escribe (también con la puntuación china `。！？`) y se salta
los bloques de código. Cada personaje puede tener su propia voz.

## Productividad

Ajustes → **Productividad**. Todo se le pide hablando o escribiendo:

| Función | Ejemplo | Detalles |
| --- | --- | --- |
| Recordatorios y temporizadores | «Recuérdame a las 6 que llame a Ana», «pon un temporizador de 10 minutos», «cada lunes a las 9, revisar las copias» | Diarios, laborables, semanales o mensuales. Si la app estaba cerrada, al abrirla avisa de los de las últimas 24 h. |
| Avisos | — | En el bocadillo y en el chat siempre; además notificación y voz, según elijas. |
| Memoria | «Acuérdate de que mi perro se llama Toby», «¿qué sabes de mí?», «olvida lo del perro» | Lo que guarda va en cada conversación. Se puede apagar y revisar en Ajustes. |
| Notas | «Apunta en la nota *Ideas* que…», «busca en mis notas lo del VPS» | Archivos Markdown en la carpeta que elijas. |
| Mira esto | `Ctrl+Alt+S` o «¿qué pone en mi pantalla?» | Captura la pantalla (sin la waifu ni el chat) y se la pasa al modelo. Pide permiso. |
| Acciones rápidas | Copia un texto y pulsa `Ctrl+Alt+Q` | Traducir, resumir, corregir, explicar o responder; puedes copiar el resultado solo. Editables y ampliables. |
| Archivos | «¿Qué hay en Descargas?», «busca el contrato del piso», «resume el PDF de la factura» | Solo en las **carpetas que autorices**; escribir pide confirmación. Lee texto, código, PDF y Word. |
| Agenda | «¿Qué tengo hoy?», «¿cuándo es la reunión con Marta?» | Enlaces iCal de Google Calendar u Outlook, o archivos `.ics`. Solo lectura. |
| Resumen diario | — | A la hora y los días que elijas te cuenta la agenda, los recordatorios y lo pendiente. |
| Web | «Léeme este artículo: https://…», «busca qué versión de Postgres es la última» | Leer páginas siempre; buscar con SearXNG, Brave Search o Tavily. Para direcciones de tu red local pide permiso. |
| Agentes | «Pídele a Hermes en segundo plano que actualice los contenedores» | Avisa cuando una tarea de Paperclip creada o comentada desde aquí acaba, se bloquea o pasa a revisión, y cuando Hermes termina. |

## Hermes Agent (en tu VPS)

La herramienta `hermes_task` le encarga a Hermes lo que deba hacerse en el servidor (revisar contenedores,
ejecutar scripts, investigar…) y te resume el resultado. Para tareas largas, pídeselo «en segundo plano»: sigues
hablando con Noa y te avisa al terminar.

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

Herramientas: listar agentes y proyectos, listar y ver tareas, **crear tareas asignadas a un agente**, cambiar
estado y prioridad, comentar y **despertar agentes**. Las tareas que crea o comenta quedan vigiladas, y te avisa
cuando terminan, se bloquean o pasan a revisión (también puedes pedirle que vigile otra).

1. En Ajustes → Hermes y Paperclip, pon la URL raíz de tu Paperclip (`http://localhost:3100` o tu dominio; la
   app añade `/api` sola).
2. En modo `authenticated`, pega un token de board:
   ```bash
   paperclipai auth login --api-base https://tu-paperclip
   paperclipai token board create --name waifu-desk --never-expires
   ```
   En modo `local_trusted` no hace falta.
3. Pulsa **Probar y listar empresas** y elige la tuya.

Cosas que le puedes pedir:

- «¿Qué tareas tienen pendientes mis agentes?»
- «Crea una tarea para el CTO: migrar Postgres a la 17, prioridad alta, y despiértalo.»
- «Comenta en PAP-12 que use la rama `feature/cache`.»

Las acciones que cambian algo piden confirmación. Con «Permitir siempre» dejan de hacerlo, y en
Automatizaciones puedes volver a activarlas.

## Automatizaciones

- **Webhooks**: cada uno se convierte en una herramienta (`webhook_<nombre>`). Lo importante es la
  **descripción**: es lo que la IA lee para decidir cuándo usarlo y qué `payload` mandar.
- **Servidores MCP** (stdio o HTTP): conecta cualquier servidor [Model Context Protocol](https://modelcontextprotocol.io).
  Por ejemplo:
  - Archivos: comando `npx`, argumentos `-y @modelcontextprotocol/server-filesystem C:\Users\tu\Documents`.
  - Paperclip vía MCP: `uvx paperclip-mcp --transport stdio` con `PAPERCLIP_BASE_URL` y `PAPERCLIP_API_KEY`.
- **Comandos en el PC** (`run_command`): PowerShell en Windows, bash en Linux. Cada comando se enseña y
  **necesita tu aprobación**; nunca se aprueba solo.

## Skins

Ajustes → Skins → **Importar un dibujo** (o clic derecho en Noa → Skin → Importar imagen):

1. **Imagen**: abrir archivo, pegar (`Ctrl+V`), arrastrar o pegar una URL.
2. **Fondo**: si ya es un PNG transparente no hace falta nada. Si no:
   - **Recorte con IA**: modelo `isnet-anime` de [SkyTNT/anime-segmentation](https://github.com/SkyTNT/anime-segmentation)
     (Apache-2.0, empaquetado por [rembg](https://github.com/danielgatis/rembg)). Se descarga una vez (176 MB) y
     corre **en local** con onnxruntime-web; tu imagen no sale del PC.
   - **Quitar color de fondo**: para fondos lisos, con tolerancia ajustable.
3. **Puntos de animación**: detecta la cara por el tono de piel y los ojos como huecos dentro de ella. Arrastra
   los marcadores: óvalos de los ojos (con las pestañas), boca y cuello (por donde gira la cabeza). `Shift` al
   arrastrar un ojo mueve los dos en vertical; `Alt` al redimensionar iguala el tamaño.
4. **Guardar y usar**. La vista previa animada se actualiza en directo.

Funciona mejor con personajes **de frente y de cintura para arriba**.

### Skins con capas

Una skin es una carpeta con `skin.json` y sus imágenes dentro de la carpeta de datos (Ajustes → General → Abrir
carpeta de datos → `skins/`). Si además de `base` añades capas del mismo tamaño, se usan en lugar de los
efectos automáticos. `names` es opcional y traduce el nombre:

```json
{
  "name": "Mi waifu",
  "names": { "en": "My waifu", "zh": "我的老婆" },
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

La skin de serie (Noa) está hecha así y se genera con `npm run skin:default`.

## Skins 3D (VRM)

Ajustes → Skins → **Importar un modelo 3D (VRM)** (o clic derecho en Noa → Skin → Importar modelo 3D):

1. **Modelo**: un archivo `.vrm` (VRM 0.x o 1.0) o el enlace directo a uno. Sitios para conseguirlos:
   [VRoid Hub](https://hub.vroid.com) (los que permiten descarga), [Booth](https://booth.pm) o hazte el tuyo
   gratis con [VRoid Studio](https://vroid.com/studio). Hasta 150 MB.
2. **Licencia**: la app enseña lo que declaró la autoría del modelo (quién puede usarlo, uso comercial,
   redistribución, modificación, crédito). **Úsalo solo como permite.**
3. **Encuadre**: cuerpo entero, medio cuerpo o busto, con zoom, giro, ángulo de cámara y altura. La ventana de la
   waifu toma la forma del encuadre.
4. **Pruébala**: estados (reposo, pensando, escuchando, trabajando, hablando), caras y saludo.
5. **Movimientos**: importa animaciones `.vrma` (por ejemplo, el pack gratuito de VRoid en Booth) o `.fbx` de
   [Mixamo](https://www.mixamo.com) (descarga «Without Skin») y asígnalas a un estado o gesto. Valen para todas
   las skins 3D; si no asignas nada, usa los movimientos de serie.
6. **Guardar y usar**.

**Caras según la IA**: el modelo marca el tono con etiquetas ocultas (`<emo:happy>`, `<emo:sad>`…) que la app
quita del texto y convierte en expresiones. Se desactiva en Ajustes → General → «Pone caras según el tono de la
IA».

La skin 3D de serie, **Noa 3D**, es la chica de ejemplo de pixiv del repositorio
[three-vrm](https://github.com/pixiv/three-vrm) (VRM 1.0, permite redistribuirla y modificarla sin pedir
crédito; ver [`assets/skins/noa-3d/LICENSE.txt`](assets/skins/noa-3d/LICENSE.txt)).

El 3D necesita GPU: sin aceleración (máquinas virtuales, escritorio remoto) va a pocos fotogramas por segundo y
es mejor usar una skin 2D.

## Avatares VTuber (Live2D)

Ajustes → Skins → **Importar un modelo VTuber (Live2D)** (o clic derecho en Noa → Skin → Importar modelo
VTuber). Valen los modelos **Cubism 3, 4 y 5** (`.model3.json`), como los de VTube Studio,
[Booth](https://booth.pm) o [nizima](https://nizima.com). Los antiguos de Cubism 2 (`.moc`, `model.json`) no.

1. **Cubism Core**: el motor de Live2D es propietario y no va dentro de la app. La primera vez te enseña el
   resumen de su licencia (gratis para particulares y empresas pequeñas;
   [licencia completa](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)) y,
   si aceptas, lo descarga del SDK oficial de Live2D (5-r.4). También puedes importar el `.zip` del SDK o
   `live2dcubismcore.min.js`. El Core de Cubism 5.3 (SDK 5-r.5 o posterior) todavía no lo admite el motor, y
   por eso tampoco los modelos exportados para Cubism 5.3.
2. **Modelo**: un `.zip` o una carpeta (hasta 300 MB y 2000 archivos). Si trae varios modelos, eliges uno.
3. **Licencia**: la app enseña los archivos de condiciones que traiga el modelo. **Úsalo solo como permiten.**
4. **Configuración de VTube Studio**: si el modelo trae su `.vtube.json`, se mueve como en VTube Studio: los
   mismos rangos, el suavizado, la respiración y las expresiones de sus atajos. Si no, usa los parámetros
   estándar de Cubism (`ParamAngleX`, `ParamEyeLOpen`, `ParamMouthOpenY`…).
5. **Encuadre** (cuerpo entero, medio cuerpo o busto, zoom y altura), **caras** para cada emoción (se asignan
   solas por el nombre de la expresión) y **deslizadores** para probar cada parámetro.
6. **Guardar y usar**.

No hay modelo Live2D de serie: las licencias de los modelos de ejemplo no permiten incluirlos.

---

## Desarrollo

Necesitas **Node.js 22.13 o superior**.

```bash
git clone https://github.com/lilpissbaby/noa-ai-waifu-assistant.git
cd noa-ai-waifu-assistant
npm install
npm start
```

| Comando | Qué hace |
| --- | --- |
| `npm start` | Arranca la app desde el código |
| `npm test` | Tests unitarios (traducciones, adaptadores de LLM, agente, herramientas, voz, ajustes) |
| `npm run lint` | ESLint |
| `npm run smoke` | Arranca la app de verdad, recorre todas las ventanas en los 5 idiomas y hace una conversación con herramientas contra un servidor simulado. En Linux sin pantalla: `xvfb-run -a npm run smoke` |
| `npm run screenshots` | Regenera las capturas de `docs/screenshots` (en Linux: `xvfb-run -a -s "-screen 0 3840x2400x24" npm run screenshots`) |
| `npm run dist:win` | Windows: `.zip` + instalador NSIS en `dist/`. Funciona en Windows, Linux o macOS sin Wine (necesita `makensis`) |
| `npm run dist:linux` | Linux: AppImage + `.deb` |

La prueba de humo y las capturas prueban además las voces Piper y Live2D si les das con qué:

- `WAIFU_TEST_PIPER_VOICE=<carpeta con una voz .onnx + .onnx.json>` (y, sin red, `WAIFU_TEST_PIPER_RUNTIME=<tarball de @diffusionstudio/piper-wasm>`).
- `WAIFU_TEST_LIVE2D_DIR=<carpeta>`, preparada con `node tools/fetch-live2d-fixtures.mjs <carpeta>` (SDK de
  Cubism y Hiyori; no se suben al repositorio).

El CI hace las dos cosas.

### CI y releases

- **[CI](.github/workflows/ci.yml)**, en cada push y pull request: lint, tests y prueba de humo en Linux y en
  Windows, y compilación de todos los ejecutables (se pueden descargar como artefacto de la ejecución).
- **[Release](.github/workflows/release.yml)**: cuando el CI de `main` termina en verde con una versión nueva
  en `package.json`, crea el tag `vX.Y.Z` y publica la release con los ejecutables y las notas de
  `CHANGELOG.md`.

Para sacar una versión:

1. Sube `version` en `package.json` (`npm version 0.4.0 --no-git-tag-version`).
2. Añade su apartado `## [0.4.0]` en `CHANGELOG.md`.
3. Commit y push a `main`. En unos minutos está la release.

Las versiones con sufijo (`0.4.0-beta.1`) salen como *prerelease*. También puedes empujar tú el tag `vX.Y.Z`
(tiene que coincidir con `package.json`).

### Cómo está hecho

```
src/
  main/            proceso principal (Electron)
    main.js        ventanas, bandeja, atajos, protocolo app://, idioma, orquestación chat + voz
    config.js      ajustes + claves cifradas (safeStorage), valores por defecto según el idioma
    llm/           adaptadores Anthropic, OpenAI-compatible y Azure (streaming, tool use, imágenes) y bucle de agente
    tools/         herramientas: básicas, personajes, productividad, Hermes, Paperclip, webhooks, cliente MCP
    productivity/  recordatorios, memoria, notas, archivos y documentos, agenda, resumen diario, web, vigilancia de Paperclip
    voice.js       transcripción, síntesis y troceado en frases
    piper-runtime.js, voices.js   motor Piper (descarga comprobada) y voces: catálogo, importación, licencias
    attachments.js imágenes adjuntas al chat
    skins.js       skins (2D, VRM y Live2D) y descarga del modelo de recorte
    live2d.js      Cubism Core e importación de modelos Live2D
    zip.js, tar.js lectura segura de .zip y .tgz (sin rutas fuera, con límites)
    vrm-files.js   comprobación de archivos VRM y de su licencia
    motions.js     biblioteca de movimientos importados (.vrma, .fbx)
    log.js         registro de diagnóstico
  preload/         puente seguro (contextIsolation + sandbox)
  renderer/
    avatar/        ventana transparente con la waifu, micrófono y reproducción con lip-sync
    chat/          panel de chat
    settings/      ajustes
    editor/        importador de skins 2D (recorte IA, marcadores, vista previa)
    vrm-editor/    importador de skins 3D y VTuber (licencia, encuadre, movimientos, parámetros)
    shared/        comportamiento del avatar (behaviour.js) y bucle (stage.js), renderizador 2D WebGL2
                   con malla deformable (y respaldo 2D), markdown
    shared/vrm/    renderizador VRM (three.js + three-vrm), encuadre, labios y mirada, animaciones
                   propias (clips/), importación de .vrma y Mixamo
    shared/live2d/ renderizador Live2D (pixi.js + untitled-pixi-live2d-engine) y traducción de las
                   señales del avatar a las entradas y parámetros de VTube Studio
    avatar/piper-worker.js   síntesis Piper con onnxruntime-web en un worker
  shared/          personajes y filtros, acciones rápidas, traducciones (i18n/: es, en, ru, uk, zh)
assets/skins/default/   skin de serie en capas SVG
assets/skins/noa-3d/    skin 3D de serie (VRM de ejemplo de pixiv)
build/                  icono, instalador NSIS multilingüe y hook que pone icono y versión al .exe
test/                   tests (node:test) con un stub de Electron
tools/                  generador de la skin, prueba de humo, capturas, fixtures de Live2D y notas de release
docs/azure/             Terraform de las políticas de contenido de Azure OpenAI
.github/workflows/      CI y releases
```

- La ventana del avatar es transparente y deja pasar los clics fuera de la silueta (en Windows con reenvío del
  ratón; en Linux recortando la forma de la ventana).
- `Behaviour` decide qué hace el avatar (respiración, parpadeo, boca, mirada, saltito, emoción) y cada
  renderizador lo dibuja a su manera. En 2D se deforma una malla 40×N en la GPU (respiración, giro de cabeza
  alrededor del cuello y mandíbula; parpadeo y boca por capas o con shaders). En 3D se mezclan el clip del
  estado, los gestos y una capa procedural (mirada, respiración), y las expresiones del VRM hacen los labios,
  el parpadeo y las caras.
- three.js y three-vrm se sirven tal cual desde `node_modules` (sin bundler) con un *import map* autorizado por
  hash en la CSP; `node tools/importmap.mjs <página.html>` lo añade a una página nueva.
- El prompt de sistema y las descripciones de las herramientas van en inglés (todos los modelos lo entienden
  igual); la respuesta sale en el idioma elegido.
- pixi.js y el motor de Live2D se cargan con sus builds UMD solo cuando la skin es Live2D, para no relajar la CSP.
- Una herramienta nueva es un objeto `{ name, group, description, schema, run }` en `src/main/tools/` registrado
  en `tools/index.js`. Sus textos para el usuario (confirmaciones, avisos) van con `t()` y sus claves en los
  cinco archivos de `src/shared/i18n/locales/`.

## Notas por plataforma

- **Windows 10/11**: todo funciona tal cual.
- **Linux**: necesita un compositor para la transparencia (GNOME, KDE, Hyprland… lo traen). En X11 sin
  compositor se ve un rectángulo negro. «Arrancar al iniciar sesión» no está disponible desde la app: añade
  Waifu Desk a tus aplicaciones de inicio.
- **Android / iOS**: pendiente (ver hoja de ruta).

## Solución de problemas

- **Algo no va**: Ajustes → General → **Ver registro de errores** (`%APPDATA%\Waifu Desk\waifu-desk.log` en
  Windows, `~/.config/Waifu Desk/waifu-desk.log` en Linux).
- **Error de saldo con Claude**: la API de Anthropic se paga aparte de claude.ai; añade crédito en la consola o
  usa un perfil gratuito.
- **No me oye**: en Windows, Configuración → Privacidad y seguridad → Micrófono → «Permitir que las aplicaciones
  de escritorio accedan al micrófono». Y revisa que el dictado tenga clave en Ajustes → Voz.
- **No habla**: con «Voces del sistema» necesitas una voz instalada del idioma de la respuesta; con Piper, el
  motor descargado y una voz elegida. Prueba con **Probar voz**.
- **La skin Live2D no sale**: falta el Cubism Core; instálalo en Ajustes → Skins. Si el modelo es de Cubism 2,
  no es compatible.
- **«No ha aceptado la imagen»**: el modelo no ve imágenes. Usa otro o desmarca «Puede ver imágenes» en su
  perfil.
- **Los recordatorios no suenan**: en Ajustes → Productividad → Avisos elige «Bocadillo, notificación y voz».
- **Un atajo no funciona**: otra app lo está usando; el registro lo indica. Cámbialo en Ajustes → General.
- **No la veo**: clic en el icono de la bandeja. Si la moviste a un monitor que ya no está, vuelve sola a la
  esquina inferior derecha al arrancar.

## Hoja de ruta

- Android: superposición sobre otras apps (permiso «mostrar sobre otras apps»), reutilizando el renderizador y
  los conectores.
- iOS: no deja dibujar encima de otras apps; widget, Live Activity o atajo de Siri.
- Proveedor «Claude Code» para usar tu suscripción de Claude a través del Claude Code oficial.
- Palabra de activación y visemas a partir de la voz.
- Crear eventos en el calendario (hoy se hace con un servidor MCP de Google Calendar).

## Privacidad

Todo se guarda en tu carpeta de datos local: ajustes, claves cifradas, conversación y sus adjuntos, memoria,
notas, recordatorios, voces, skins y movimientos. «Nueva conversación» borra también las imágenes adjuntas.

La app solo se conecta a los servicios que configures (modelos, Hermes, Paperclip, calendarios, buscador) y,
cuando tú lo pides, a GitHub (modelo de recorte), al registro de npm (motor de Piper), a Hugging Face (voces
Piper), a live2d.com (Cubism Core), a la URL de un modelo VRM y a las páginas que le pidas leer. Las capturas de
pantalla piden permiso y solo salen hacia el modelo con el que hablas. Los archivos solo se leen dentro de las
carpetas que autorices.

## Licencia

[MIT](LICENSE) © mupsim. La skin de serie Noa es original de este proyecto. Noa 3D es un modelo de ejemplo de
pixiv Inc. ([licencia](assets/skins/noa-3d/LICENSE.txt)).

Incluye: [three.js](https://threejs.org) y [three-vrm](https://github.com/pixiv/three-vrm) (MIT; el mapa de
huesos de Mixamo viene de sus ejemplos), [pixi.js](https://pixijs.com) (MIT),
[untitled-pixi-live2d-engine](https://github.com/Untitled-Story/untitled-pixi-live2d-engine) (MIT),
[onnxruntime-web](https://onnxruntime.ai) (MIT), [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0),
[Readability](https://github.com/mozilla/readability) (Apache-2.0), [linkedom](https://github.com/WebReflection/linkedom)
(ISC), [ical.js](https://github.com/kewisch/ical.js) (MPL-2.0) y el SDK de MCP (MIT). El plugin WinShell de
NSIS está bajo licencia zlib ([build/nsis](build/nsis/README.md)).

Se descargan aparte, solo si los usas, y tienen su propia licencia: el modelo de recorte `isnet-anime`
(Apache-2.0); el motor de Piper ([piper-wasm](https://www.npmjs.com/package/@diffusionstudio/piper-wasm), con
espeak-ng, GPL-3.0); cada voz Piper (la suya, que la app enseña); y el **Live2D Cubism Core** (propietario de
Live2D Inc., con su [licencia](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)).
El modelo Hiyori de las capturas es material de ejemplo © Live2D Inc.
([Free Material License](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)) y no se
incluye en la app.
