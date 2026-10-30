#!/usr/bin/env node
// Genera docs/herramientas.md: todas las herramientas que puede usar la asistente, sacadas del
// propio código (descripción, parámetros, si piden permiso y cuándo están disponibles).
//   node --import ./test/setup.mjs tools/gen-tools-doc.mjs
import fs from 'node:fs';
import path from 'node:path';
import { buildToolbox } from '../src/main/tools/index.js';
import { setLocale } from '../src/shared/i18n/index.js';

setLocale('es');
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'herramientas.md');

// Configuración con todo activado (lo que no se configura no aparece en la app).
const cfg = {
  personas: [{ id: 'noa', name: 'Noa', filters: {} }],
  activePersonaId: 'noa',
  content: {},
  productivity: {
    memory: true,
    folders: ['/home/usuario/Documentos'],
    calendars: [{ id: 'c', name: 'Trabajo', url: 'https://example.com/a.ics' }],
    search: { provider: 'searxng', baseUrl: 'https://searx.example.com' },
    weather: { label: 'Valencia', lat: 39.47, lon: -0.38 },
    feeds: [{ id: 'f', name: 'Hacker News', url: 'https://news.ycombinator.com/rss' }],
    clipboardHistory: { enabled: true },
    monitors: { list: [{ id: 'm', name: 'VPS', url: 'https://example.com' }] },
    routines: [],
  },
  connectors: {
    shell: { enabled: true },
    hermes: { enabled: true, baseUrl: 'https://hermes.example.com/v1' },
    paperclip: { enabled: true, baseUrl: 'https://paperclip.example.com', companyId: 'c1' },
    github: { enabled: true, watchRepos: ['owner/repo'] },
    homeassistant: { enabled: true, baseUrl: 'http://homeassistant.local:8123' },
    push: { provider: 'ntfy', topic: 'x' },
    webhooks: [{ id: 'w', name: 'n8n', description: 'Ejemplo de webhook: lo que pongas en su descripción.', url: 'https://n8n.example.com/webhook/x', enabled: true }],
    mcpServers: [],
  },
  tools: { autoApprove: {} },
};
const stub = { list: () => [], states: () => [], add: () => ({}), get: () => null };
const services = { reminders: stub, tasks: stub, focus: stub, routineLog: stub, clipHistory: stub, monitors: stub, captureScreen: async () => ({}), watchIssue() {}, runBackground() {}, switchPersona() {}, openWindow() {}, configChanged() {} };
const tools = buildToolbox(cfg, null, services);

// Grupos en el orden de la documentación, con su título en español y cuándo están disponibles.
const GROUPS = [
  ['check the date and time', 'Básicas', 'Siempre.'],
  ['open links in the browser', 'Básicas', 'Siempre.'],
  ['read and write the clipboard', 'Básicas', 'Siempre.'],
  ['show system notifications', 'Básicas', 'Siempre.'],
  ['switch or adjust your own character', 'Personajes', 'Siempre.'],
  ['reminders and timers', 'Recordatorios y temporizadores', 'Siempre.'],
  ['to-do list', 'Tareas', 'Siempre.'],
  ['scheduled routines', 'Rutinas', 'Siempre.'],
  ['focus mode (Pomodoro)', 'Concentración', 'Siempre.'],
  ['remember facts about the user', 'Memoria', 'Si la memoria está activada (Productividad).'],
  ['take and look up notes', 'Notas', 'Siempre.'],
  ["see the user's screen", 'Ver la pantalla', 'Siempre (pide permiso).'],
  ['list, search, read and write files in the folders the user authorized', 'Archivos', 'Con al menos una carpeta autorizada (Productividad).'],
  ["check the user's calendar", 'Agenda', 'Con al menos un calendario (Productividad).'],
  ['read web pages and search the web', 'Web', 'Leer, siempre; buscar, con buscador configurado.'],
  ['weather forecast', 'El tiempo', 'Siempre (sin ciudad configurada pide una).'],
  ['news from RSS feeds', 'Noticias', 'Con al menos una fuente RSS (Productividad).'],
  ["check this computer's status", 'Estado del PC', 'Siempre.'],
  ['clipboard history', 'Historial del portapapeles', 'Si está activado (Productividad).'],
  ['service monitor', 'Monitor de servicios', 'Con al menos un servicio vigilado (Automatizaciones).'],
  ["send notifications to the user's phone", 'Móvil', 'Con un servicio de avisos configurado (Conectores).'],
  ['delegate long tasks to the Hermes agent', 'Hermes Agent', 'Con Hermes activado (Conectores).'],
  ['manage tasks and AI agents in Paperclip', 'Paperclip', 'Con Paperclip activado (Conectores).'],
  ['GitHub', 'GitHub', 'Con GitHub activado y token (Conectores).'],
  ['Home Assistant (smart home)', 'Home Assistant', 'Con Home Assistant activado (Conectores).'],
  ["trigger the user's automations (webhooks)", 'Webhooks', 'Uno por webhook activado (Automatizaciones).'],
  ['run commands on the PC', 'Comandos', 'Si lo activas (Automatizaciones); siempre pide permiso.'],
];
const ASKS = { yes: 'Sí', sometimes: 'Según el caso', no: '—' };
const groupOf = (tool) => GROUPS.find(([g]) => tool.group.startsWith(g)) || [tool.group, tool.group, ''];

const params = (schema) => {
  const props = schema?.properties || {};
  const req = new Set(schema?.required || []);
  const list = Object.entries(props).map(([k, v]) => `\`${k}\`${req.has(k) ? '' : '?'}${v.enum ? ` (${v.enum.join(' · ')})` : ''}`);
  return list.length ? list.join(', ') : '—';
};
const order = (tool) => {
  const i = GROUPS.findIndex(([g]) => tool.group.startsWith(g));
  return i < 0 ? GROUPS.length : i;
};
const byTitle = new Map();
for (const tool of [...tools.list].sort((a, b) => order(a) - order(b))) {
  const [, title, when] = groupOf(tool);
  if (!byTitle.has(title)) byTitle.set(title, { when, tools: [] });
  byTitle.get(title).tools.push(tool);
}

const lines = [
  '# Herramientas de la asistente',
  '',
  '> Archivo generado con `node --import ./test/setup.mjs tools/gen-tools-doc.mjs`. No lo edites a mano.',
  '',
  `La asistente tiene **${tools.list.length} herramientas** propias, más las de los servidores MCP que conectes. Solo ve las que están disponibles con tu configuración (la columna «Disponible»), y cada petición le manda sus descripciones, así que menos herramientas activas también es menos gasto de tokens.`,
  '',
  'Las descripciones están en inglés porque son lo que lee el modelo para decidir cuándo usarlas; la respuesta te llega en tu idioma. Los parámetros con `?` son opcionales. Las que cambian algo fuera de la app (crear un issue, encender una luz, abrir un archivo, crear una rutina…) piden permiso antes, con «Permitir siempre» si quieres saltártelo (se deshace en Ajustes → Automatizaciones).',
  '',
  '## Índice',
  '',
  ...[...byTitle.keys()].map((title) => `- [${title}](#${title.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-')}) (${byTitle.get(title).tools.length})`),
  '',
];
for (const [title, { when, tools: list }] of byTitle) {
  lines.push(`## ${title}`, '', `Disponible: ${when}`, '', '| Herramienta | Qué hace | Parámetros | Pide permiso |', '| --- | --- | --- | --- |');
  for (const tool of list) lines.push(`| \`${tool.name}\` | ${tool.description.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${params(tool.schema)} | ${ASKS[tools.asks(tool.name)]} |`);
  lines.push('');
}
fs.writeFileSync(OUT, lines.join('\n'));
console.log(`✓ ${tools.list.length} herramientas en ${path.relative(process.cwd(), OUT)}`);
