# Claude Desktop como cerebro (sin API key)

Con el perfil **Claude Desktop (MCP)**, la asistente no llama a ninguna API: lo que le dices (por texto o por
voz) lo contesta una conversación de **Claude Desktop** abierta en tu PC, con el uso de tu suscripción de
Claude (Pro, Max, Team…). No gasta créditos de la API ni necesita clave.

Sigue siendo ella: su voz, sus caras y gestos, su bocadillo, su chat, su memoria y sus herramientas (tareas,
recordatorios, Paperclip, Hermes, GitHub, Home Assistant…). Claude pone el cerebro y, de paso, aporta las
suyas: búsqueda web, tus archivos, los conectores que tengas en Claude Desktop.

También funciona con **Claude Code** (terminal) y con cualquier cliente MCP por stdio.

## Puesta en marcha

1. Ajustes → **Conectores** → **Claude Desktop (MCP)** → **Usar Claude Desktop como cerebro**. (O en Modelos
   de IA, «Usar este» en el perfil «Claude Desktop (MCP)».)
2. **Añadir a Claude Desktop**. La app escribe su entrada en `claude_desktop_config.json` sin tocar el resto
   (guarda una copia `claude_desktop_config.json.noa-backup` la primera vez). Mira la versión normal
   (`%APPDATA%\Claude`) y la de la Microsoft Store (`%LOCALAPPDATA%\Packages\Claude_…`), y escribe en las que
   existan.
3. **Reinicia Claude Desktop** del todo (salir desde la bandeja, no solo cerrar la ventana).
4. En una conversación nueva de Claude Desktop, abre el menú **+** del cuadro de texto, busca **noa** y elige
   **Modo Noa** (el nombre cambia con tu personaje). Envíalo. Si tu versión no enseña los prompts de MCP,
   escribe «modo Noa» o pega el prompt con **Copiar el prompt del modo Noa**.
5. Cuando Claude pida permiso para las herramientas de noa, **Permitir siempre**.

A partir de ahí, háblale a la asistente como siempre. Deja esa conversación de Claude Desktop abierta (puedes
usar otras conversaciones para lo demás). Para parar, pulsa detener en Claude Desktop.

Si la app está cerrada cuando Claude la necesita (por ejemplo, al elegir el prompt), el puente la abre solo.

## Cómo funciona

Claude Desktop no deja que un servidor MCP le pida respuestas (no soporta *sampling*), así que es Claude quien
pregunta, en bucle:

```
Tú ──(texto o voz)──▶ Noa ──cola──▶ noa_listen ──▶ Claude Desktop (tu suscripción)
                                                        │  piensa, usa herramientas
Tú ◀──(bocadillo, chat, voz, caras)── Noa ◀── noa_say ◀─┘
```

- `noa_listen` espera hasta ~3 minutos a que digas algo. Si no dices nada, Claude la vuelve a llamar (eso gasta
  muy poco).
- `noa_say` es lo único que ves y oyes: sale en el bocadillo y en el chat, se lee en voz alta y las etiquetas
  `<emo:…>` y `<act:…>` le ponen la cara y los gestos, igual que con un modelo por API.
- La primera vez Claude recibe el personaje (forma de ser, idioma, límites, lo que recuerda de ti y lo último
  que habéis hablado). Si cambias de personaje, se lo vuelve a dar.

Las piezas:

| Pieza | Qué hace |
| --- | --- |
| Servidor local (`src/main/desktop-mcp/server.js`) | API JSON en `127.0.0.1`, puerto libre y token nuevo en cada arranque. Rechaza navegadores y nombres que no sean locales. |
| Puente (`noa-mcp-bridge.cjs` en tu carpeta de datos) | El servidor MCP que arranca Claude Desktop. Lo ejecuta el propio `Waifu Desk.exe` en modo Node (`ELECTRON_RUN_AS_NODE=1`), así que no hace falta instalar Node. |
| `endpoint.json`, `meta.json`, `launch.json` | Puerto y token (solo mientras la app está abierta), herramientas para cuando está cerrada y cómo abrirla. Solo los puede leer tu usuario. |

## Herramientas que ve Claude

| Herramienta | Para qué |
| --- | --- |
| `noa_listen` | Esperar al siguiente mensaje (con imágenes y archivos adjuntos). |
| `noa_say` | Que lo diga ella. `final: false` para un «voy» antes de un trabajo largo. |
| `noa_express` | Poner una cara o hacer un gesto sin hablar. |
| `noa_context` | Su ficha de personaje, su memoria y la conversación reciente. |
| `noa_tools` / `noa_run_tool` | Ver y usar las herramientas de la app. Las que tienen efectos piden permiso en tu pantalla, como siempre. |

En Ajustes puedes cambiar **Herramientas de Noa para Claude**:

- **Compactas** (por defecto): las seis de arriba. Claude busca las de la app con `noa_tools`. No llena de
  herramientas el resto de tus chats de Claude Desktop.
- **Todas sueltas**: además, cada herramienta de la app aparece como herramienta MCP propia.
- **Ninguna**: solo escuchar, hablar y poner caras.

## Uso, límites y consejos

- Gasta el uso de tu plan de Claude, no créditos de la API. Cada mensaje cuenta como un turno más de esa
  conversación, y las esperas sin mensajes cuestan muy poco.
- Claude Desktop corta cada llamada a herramienta a los 240 s; por eso cada espera dura como mucho ~3,5 min.
- Si Claude llega a su límite de pasos o lo paras, deja de escuchar. Tu mensaje se queda en cola y la asistente
  te avisa a los 20 s: escribe «sigue» en la conversación de Claude Desktop y lo recoge.
- Si la conversación se hace muy larga, empieza otra con el prompt.
- El botón de parar de la asistente tira lo que estaba en cola y calla la respuesta a medias; Claude se entera
  con el siguiente mensaje.
- El dictado por voz sigue usando la transcripción de Ajustes → Voz (Groq gratis, Whisper en tu VPS…).
- Con la conexión encendida pero otro perfil en uso («Dejar la conexión encendida…»), Claude Desktop puede igual
  hacerla hablar (`noa_say`) o usar sus herramientas desde cualquier chat.

## A mano

Ajustes → Conectores → Claude Desktop (MCP) → **A mano y en Claude Code** tiene la entrada exacta para tu PC.
Es de esta forma:

```json
{
  "mcpServers": {
    "noa": {
      "command": "C:\\Users\\tú\\AppData\\Local\\Programs\\Waifu Desk\\Waifu Desk.exe",
      "args": ["C:\\Users\\tú\\AppData\\Roaming\\Waifu Desk\\claude-desktop\\noa-mcp-bridge.cjs"],
      "env": {
        "ELECTRON_RUN_AS_NODE": "1",
        "NOA_MCP_ENDPOINT": "C:\\Users\\tú\\AppData\\Roaming\\Waifu Desk\\claude-desktop\\endpoint.json"
      }
    }
  }
}
```

Con Node instalado vale también `"command": "node"` sin `ELECTRON_RUN_AS_NODE`. Para Claude Code:

```sh
claude mcp add --scope user noa -e ELECTRON_RUN_AS_NODE=1 -e NOA_MCP_ENDPOINT=… -- "…\Waifu Desk.exe" …\noa-mcp-bridge.cjs
```

Si mueves la app de sitio (por ejemplo, el zip portable), al arrancar corrige sola la entrada que ya había.

## Problemas

- **Claude Desktop no enseña las herramientas de noa**: reinícialo del todo. En Ajustes, la lista de archivos
  dice si la entrada está «añadida». En Claude Desktop, Ajustes → Desarrollador suele mostrar el estado del
  servidor `noa` y su registro.
- **«Claude Desktop no está escuchando»**: no hay ninguna conversación en Modo Noa, o se acabó el bucle. Elige el
  prompt o escribe «sigue».
- **«Waifu Desk is closed…»** en Claude: la app estaba cerrada o con la conexión apagada y no se pudo abrir.
  Ábrela y pídele a Claude que siga.
- **El archivo no es JSON válido**: la app no toca un `claude_desktop_config.json` roto. Arréglalo (o borra lo
  que sobre) y vuelve a pulsar «Añadir».
