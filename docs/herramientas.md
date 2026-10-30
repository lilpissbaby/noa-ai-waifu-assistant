# Herramientas de la asistente

> Archivo generado con `node --import ./test/setup.mjs tools/gen-tools-doc.mjs`. No lo edites a mano.

La asistente tiene **66 herramientas** propias, más las de los servidores MCP que conectes. Solo ve las que están disponibles con tu configuración (la columna «Disponible»), y cada petición le manda sus descripciones, así que menos herramientas activas también es menos gasto de tokens.

Las descripciones están en inglés porque son lo que lee el modelo para decidir cuándo usarlas; la respuesta te llega en tu idioma. Los parámetros con `?` son opcionales. Las que cambian algo fuera de la app (crear un issue, encender una luz, abrir un archivo, crear una rutina…) piden permiso antes, con «Permitir siempre» si quieres saltártelo (se deshace en Ajustes → Automatizaciones).

## Índice

- [Básicas](#básicas) (5)
- [Personajes](#personajes) (3)
- [Recordatorios y temporizadores](#recordatorios-y-temporizadores) (3)
- [Tareas](#tareas) (5)
- [Rutinas](#rutinas) (4)
- [Concentración](#concentración) (3)
- [Memoria](#memoria) (3)
- [Notas](#notas) (4)
- [Ver la pantalla](#ver-la-pantalla) (1)
- [Archivos](#archivos) (5)
- [Agenda](#agenda) (1)
- [Web](#web) (2)
- [El tiempo](#el-tiempo) (1)
- [Noticias](#noticias) (1)
- [Estado del PC](#estado-del-pc) (1)
- [Historial del portapapeles](#historial-del-portapapeles) (1)
- [Monitor de servicios](#monitor-de-servicios) (1)
- [Móvil](#móvil) (1)
- [Hermes Agent](#hermes-agent) (1)
- [Paperclip](#paperclip) (9)
- [GitHub](#github) (7)
- [Home Assistant](#home-assistant) (2)
- [Webhooks](#webhooks) (1)
- [Comandos](#comandos) (1)

## Básicas

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `get_current_time` | Returns the current local date, time and time zone. | — | — |
| `open_url` | Opens an http(s) URL in the user's default browser. | `url` | — |
| `clipboard_read` | Reads the text currently in the user's clipboard. | — | — |
| `clipboard_write` | Copies text to the user's clipboard. | `text` | — |
| `show_notification` | Shows a system notification (useful for alerts or short summaries). | `title`, `body`? | — |

## Personajes

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `persona_list` | Lists the characters the user has set up, marking the active one. | — | — |
| `persona_switch` | Switches to another of the user's characters (personality, voice and skin change). Use it when the user asks you to become another character or mode, e.g. "work mode" or a character name. | `name` | — |
| `persona_update` | Adjusts YOUR current character when the user asks (e.g. "be grumpier", "no swearing", "be more formal"). Can rewrite the personality or context and change content filters: language avoid\|mild\|free, violence avoid\|moderate\|free, politics neutral\|opinions, romance off\|light\|on, sexual off\|suggestive\|explicit. Loosening a filter asks the user to confirm; 18+ levels require the user to unlock adult content in Settings first. | `personality`?, `scenario`?, `filters`? | Según el caso |

## Recordatorios y temporizadores

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `reminder_create` | Creates a reminder or a timer. At that moment the user gets a notice (speech bubble, desktop notification and/or voice), even if the chat is closed. Use in_minutes for timers ("in 10 minutes") and at for clock times: local ISO date-time like 2026-10-23T18:30 (the current date and time zone are in your instructions) or just HH:MM for the next time that hour comes. repeat: daily \| weekdays \| weekly \| monthly. | `text`, `at`?, `in_minutes`?, `repeat`? (daily · weekdays · weekly · monthly) | — |
| `reminder_list` | Lists the user's pending reminders and timers. | — | — |
| `reminder_cancel` | Cancels a reminder or timer by id (get ids with reminder_list). | `id` | — |

## Tareas

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `task_add` | Adds a task to the user's to-do list (things to do, not timed alerts: use reminder_create for those). Use it when the user says they have to do something or asks you to note a task. | `title`, `notes`?, `due`?, `priority`? (low · normal · high), `project`? | — |
| `task_list` | Lists tasks. filter: open (default), today (due today or overdue), overdue, week (due in the next 7 days), done or all. Optional project and query (text search). | `filter`? (open · done · all · today · overdue · week), `project`?, `query`? | — |
| `task_update` | Changes a task (title, notes, due date, priority or project) by id. Get ids with task_list. | `id`, `title`?, `notes`?, `due`?, `priority`? (low · normal · high), `project`? | — |
| `task_complete` | Marks a task as done (or as not done with done=false). | `id`, `done`? | — |
| `task_delete` | Deletes a task by id. Prefer task_complete for tasks the user finished. | `id` | — |

## Rutinas

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `routine_create` | Creates a routine: a request that YOU will run automatically at a time on some days, then report the result to the user (e.g. "every Monday at 9 ask Hermes about the backups and tell me", "every weekday at 8:00 summarize my GitHub notifications"). prompt is the instruction you will receive then, written as a complete request. days: daily (default), weekdays, weekends or a list of 1-7 (1 = Monday). For simple alerts use reminder_create instead. | `name`, `prompt`, `time`, `days`? | Sí |
| `routine_list` | Lists the scheduled routines. | — | — |
| `routine_update` | Changes a routine (name, prompt, time, days or enabled) by id. | `id`, `name`?, `prompt`?, `time`?, `days`?, `enabled`? | Sí |
| `routine_delete` | Deletes a routine by id. | `id` | — |

## Concentración

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `focus_start` | Starts a focus session (Pomodoro): a work block (default from settings, usually 25 min) followed by breaks; you will announce each change. While working, notices are kept quiet if the user enabled "do not disturb". Optional label: what they are working on. | `minutes`?, `label`? | — |
| `focus_stop` | Stops the focus session. | — | — |
| `focus_status` | Current focus phase (work, short, long or off), time left and today's focused minutes and sessions, plus the last 7 days. | — | — |

## Memoria

Disponible: Si la memoria está activada (Productividad).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `memory_save` | Saves a lasting fact about the user (preferences, names of people and pets, projects, how they like things done) so you remember it in future conversations. Use it when they ask you to remember something or share a durable preference. Never save passwords, keys or card numbers. | `fact` | — |
| `memory_list` | Lists everything you remember about the user, with ids. | — | — |
| `memory_forget` | Forgets a saved fact by id (when the user asks you to forget it or it is no longer true). | `id` | — |

## Notas

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `note_create` | Creates a new Markdown note in the user's notes folder. If the title exists, a numbered copy is made (use note_append to add to an existing note). | `title`, `content` | — |
| `note_append` | Adds text to the end of a note (creates it if it does not exist). Good for lists, journals and meeting notes. | `title`, `content` | — |
| `note_read` | Reads a note by title. | `title` | — |
| `note_search` | Searches the notes by title and content (subfolders included). Returns up to 20 titles with a snippet. | `query` | — |

## Ver la pantalla

Disponible: Siempre (pide permiso).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `screen_capture` | Takes a screenshot of the user's screen (target 'screen', the one with the mouse) or of the window on top ('window') and shows it to you. Use it when the user asks you to look at something, to help with what is on screen, or to read an error they see. | `target`? (screen · window) | Sí |

## Archivos

Disponible: Con al menos una carpeta autorizada (Productividad).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `files_list` | Lists a folder (or, without path, the authorized folders). | `path`? | — |
| `files_search` | Searches files by name and by content (text files) inside the authorized folders, or inside path. Up to 50 results. | `query`, `path`? | — |
| `files_read` | Reads a text file, a PDF or a Word .docx (up to 100,000 characters). | `path` | — |
| `files_open` | Opens a file or folder from the authorized folders with the user's default app (e.g. a PDF in the PDF viewer, a folder in the file explorer). Asks the user first. | `path` | Sí |
| `files_write` | Writes a text file (creates it or replaces it) inside the authorized folders. The user always confirms. | `path`, `content` | Sí |

## Agenda

Disponible: Con al menos un calendario (Productividad).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `calendar_events` | Lists events from the user's calendars. Without arguments: today. from/to are local dates (YYYY-MM-DD, to is exclusive) or date-times; up to 92 days. query filters by text in title, place or description. | `from`?, `to`?, `query`? | — |

## Web

Disponible: Leer, siempre; buscar, con buscador configurado.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `web_fetch` | Reads a web page or online PDF and returns its main text (up to 20,000 characters). Use it to read links the user shares or results from web_search. | `url` | Según el caso |
| `web_search` | Searches the web and returns titles, URLs and snippets. Then read the most relevant pages with web_fetch before answering, and cite the URLs you used. | `query`, `count`? | — |

## El tiempo

Disponible: Siempre (sin ciudad configurada pide una).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `weather` | Current weather and forecast (up to 7 days) from Open-Meteo. Without location it uses the user's city from settings (Valencia). location: a city name, optionally with country ("Valencia, ES"). | `location`?, `days`? | — |

## Noticias

Disponible: Con al menos una fuente RSS (Productividad).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `news_read` | Latest headlines from the user's RSS/Atom feeds (Hacker News). Optional feed (one of those names), query (text filter) and limit (default 10). Read a full article with web_fetch if the user wants details. | `feed`?, `query`?, `limit`? | — |

## Estado del PC

Disponible: Siempre.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `system_status` | Status of this computer: CPU usage, memory, disks (free space), network addresses, uptime and power. processes=true also lists the processes using the most CPU or memory. | `processes`? | — |

## Historial del portapapeles

Disponible: Si está activado (Productividad).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `clipboard_history` | Texts the user copied recently in this session (newest first). Optional query (text filter) and limit (default 10). Use it for "what did I copy before?" or to recover something they copied. | `query`?, `limit`? | — |

## Monitor de servicios

Disponible: Con al menos un servicio vigilado (Automatizaciones).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `monitor_status` | State of the websites and services the user monitors (VPS): up or down, since when, response time. check=true checks them all again now. | `check`? | — |

## Móvil

Disponible: Con un servicio de avisos configurado (Conectores).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `phone_notify` | Sends a push notification to the user's own phone. Use it when they ask to be notified on the phone ("send me the list to my phone", "let me know on the phone when Hermes finishes"). priority: low \| default \| high \| urgent. | `message`, `title`?, `priority`? (low · default · high · urgent), `url`? | — |

## Hermes Agent

Disponible: Con Hermes activado (Conectores).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `hermes_task` | Sends a task to the Hermes agent running on the user's VPS and waits for its answer. Hermes can run commands on the server, browse the web, schedule jobs and remember things across sessions. Use it for work that must happen on the server or for long research/automation tasks. Describe the task in a self-contained way. With background: true it returns immediately and the user is notified (chat, bubble, notification) when Hermes finishes: use it for tasks that may take minutes. | `task`, `context`?, `background`? | — |

## Paperclip

Disponible: Con Paperclip activado (Conectores).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `paperclip_list_agents` | Lists the company's AI agents in Paperclip (id, name, role, status). Use it to find out who to assign work to. | — | — |
| `paperclip_list_projects` | Lists the company's projects in Paperclip. | — | — |
| `paperclip_list_issues` | Lists Paperclip tasks (issues), optionally filtered by status, assigned agent or project. | `status`?, `assigneeAgentId`?, `projectId`?, `limit`? | — |
| `paperclip_get_issue` | Gets the details of a Paperclip task and its latest comments. | `issueId` | — |
| `paperclip_create_issue` | Creates a task in Paperclip and optionally assigns it to an agent, to delegate work to the user's AI agents. Call paperclip_list_agents first if you don't know the agent id. | `title`, `description`?, `priority`? (critical · high · medium · low), `status`? (backlog · todo), `assigneeAgentId`?, `projectId`?, `parentId`? | Sí |
| `paperclip_update_issue` | Updates a Paperclip task: status, priority, assignee, title or description, and optionally adds a comment. | `issueId`, `status`? (backlog · todo · in_progress · in_review · blocked · done · cancelled), `priority`? (critical · high · medium · low), `assigneeAgentId`?, `title`?, `description`?, `comment`? | Sí |
| `paperclip_add_comment` | Adds a (markdown) comment to a Paperclip task, for example to give an agent instructions. | `issueId`, `body`, `reopen`? | Sí |
| `paperclip_watch` | Watches a Paperclip task: the user gets a notice when it is done, blocked, needs review or is cancelled. Tasks you create or comment on are watched automatically. | `issueId` | — |
| `paperclip_wakeup_agent` | Wakes a Paperclip agent up so it runs a heartbeat now (for example after assigning it a task). | `agentId`, `reason`?, `issueId`? | Sí |

## GitHub

Disponible: Con GitHub activado y token (Conectores).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `github_notifications` | The user's unread GitHub notifications (mentions, review requests, CI, issues). all=true includes read ones. | `all`? | — |
| `github_search` | Searches issues and pull requests with GitHub search syntax, e.g. "is:open is:pr review-requested:@me", "is:open is:issue assignee:@me", "repo:owner/name is:open label:bug". Returns up to 30. | `query` | — |
| `github_issue` | Reads an issue or pull request with its latest comments. | `repo`, `number` | — |
| `github_repo` | Overview of a repository: description, default branch, stars, open issues, last push, latest release and open pull requests. | `repo` | — |
| `github_ci` | Latest GitHub Actions runs of a repository (watched: owner/repo): workflow, branch, status and conclusion. Optional branch. | `repo`, `branch`? | — |
| `github_create_issue` | Creates an issue in a repository. Asks the user first. | `repo`, `title`, `body`?, `labels`? | Sí |
| `github_comment` | Adds a comment to an issue or pull request. Asks the user first. | `repo`, `number`, `body` | Sí |

## Home Assistant

Disponible: Con Home Assistant activado (Conectores).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `ha_states` | States of Home Assistant entities (lights, switches, sensors, climate, covers, media players…). Filter by domain (light, switch, sensor, climate, cover, media_player, binary_sensor…) and/or search (text in the entity id or friendly name). Returns up to 80. | `domain`?, `search`? | — |
| `ha_call_service` | Runs a Home Assistant action, e.g. domain "light" service "turn_on" with entity_id "light.salon" and data {"brightness_pct": 40}; "switch.turn_off"; "climate.set_temperature" with data {"temperature": 21}; "script.turn_on"; "scene.turn_on". Look up entity ids with ha_states first. Asks the user first. | `domain`, `service`, `entity_id`?, `data`? | Sí |

## Webhooks

Disponible: Uno por webhook activado (Automatizaciones).

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `webhook_n8n` | Ejemplo de webhook: lo que pongas en su descripción. (POST to one of the user's automations). | `payload`? | — |

## Comandos

Disponible: Si lo activas (Automatizaciones); siempre pide permiso.

| Herramienta | Qué hace | Parámetros | Pide permiso |
| --- | --- | --- | --- |
| `run_command` | Runs a command on the user's PC with bash and returns stdout/stderr. The user must approve it every time. Useful for ssh to the VPS, docker, git, scripts. | `command`, `cwd`?, `timeout_sec`? | Sí |
