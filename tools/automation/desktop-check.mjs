// Claude Desktop (MCP) en la app real: arranca el puente igual que Claude Desktop (el ejecutable de
// Electron con ELECTRON_RUN_AS_NODE=1), se conecta con el SDK oficial de MCP y hace una vuelta
// completa: noa_listen recibe lo que se le escribe a la asistente, noa_say lo contesta en el chat
// con su cara, y noa_run_tool usa una herramienta suya.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { sleep, waitForChat, waitForWindow } from './common.mjs';

const textOf = (r) => (r?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');

export async function desktopCheck(api, problems) {
  const before = api.loadConfig();
  const prevProfile = before.activeProfileId;
  if (!before.profiles.some((p) => p.kind === 'claude-desktop'))
    api.patchConfig({ profiles: [...before.profiles, { id: 'claude-desktop', kind: 'claude-desktop', name: 'Claude Desktop (MCP)', baseUrl: '', model: 'claude-desktop', toolsEnabled: true }] });
  api.patchConfig({ activeProfileId: api.loadConfig().profiles.find((p) => p.kind === 'claude-desktop').id });
  await api.desktopMcp.sync();
  if (!api.desktopMcp.running()) return problems.push('claude desktop: el servidor local no arrancó');
  const info = api.desktopMcp.info();
  const entry = JSON.parse(info.snippet).mcpServers.noa;

  const transport = new StdioClientTransport({ command: entry.command, args: entry.args, env: { ...process.env, ...entry.env }, stderr: 'pipe' });
  const client = new Client({ name: 'smoke-claude-desktop', version: '1.0.0' });
  try {
    await client.connect(transport);
  } catch (e) {
    return problems.push(`claude desktop: el puente no arranca con ELECTRON_RUN_AS_NODE (${e.message})`);
  }
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const n of ['noa_listen', 'noa_say', 'noa_context', 'noa_tools', 'noa_run_tool']) if (!names.includes(n)) problems.push(`claude desktop: falta la herramienta ${n}`);
    const prompt = await client.getPrompt({ name: 'noa' });
    const promptText = prompt.messages[0]?.content?.text || '';
    if (!/noa_listen/.test(promptText) || !/Who you are: Noa/.test(promptText)) problems.push('claude desktop: el prompt «noa» no trae el bucle y el personaje');

    // El usuario escribe a la asistente mientras Claude escucha.
    api.newConversation();
    const listening = client.callTool({ name: 'noa_listen', arguments: { timeout_seconds: 20 } });
    await sleep(300);
    if (!api.desktopMcp.host.status().listening) problems.push('claude desktop: noa_listen no está esperando');
    const started = waitForChat(api, (e) => e.type === 'assistant_start', 10000);
    await api.sendMessage('Hola desde la prueba de humo', 'text');
    const heard = textOf(await listening);
    if (!heard.includes('Hola desde la prueba de humo')) problems.push(`claude desktop: noa_listen no trajo el mensaje (${heard.slice(0, 160)})`);
    // El prompt ya dio el personaje en esta sesión: la escucha no lo repite.
    if (/Who you are/.test(heard)) problems.push('claude desktop: la escucha repite el personaje que ya dio el prompt');
    await started.catch(() => problems.push('claude desktop: el chat no abrió la respuesta'));

    const ctxText = textOf(await client.callTool({ name: 'noa_context', arguments: { history: 5 } }));
    if (!ctxText.includes('Hola desde la prueba de humo') || !/Always reply in Spanish/.test(ctxText)) problems.push(`claude desktop: noa_context incompleto (${ctxText.slice(0, 160)})`);
    // Una herramienta suya y la respuesta.
    const time = textOf(await client.callTool({ name: 'noa_run_tool', arguments: { name: 'get_current_time', input: {} } }));
    if (!/timezone/.test(time)) problems.push(`claude desktop: noa_run_tool no devolvió la hora (${time.slice(0, 160)})`);
    const done = waitForChat(api, (e) => e.type === 'done', 10000);
    await client.callTool({ name: 'noa_say', arguments: { text: '<emo:happy><act:wave>¡Hola! Te contesto desde Claude Desktop.' } });
    await done.catch(() => problems.push('claude desktop: noa_say no cerró la respuesta'));
    await sleep(300);
    const reply = await api.wins.chat.webContents.executeJavaScript(`[...document.querySelectorAll('.msg.assistant .body')].map((b) => b.textContent).join(' | ')`);
    if (!reply.includes('Te contesto desde Claude Desktop')) problems.push(`claude desktop: la respuesta no está en el chat (${reply.slice(0, 160)})`);
    if (reply.includes('<emo:') || reply.includes('<act:')) problems.push('claude desktop: las etiquetas llegaron al chat');
    const emo = await api.wins.avatar.webContents.executeJavaScript('window.__wd.behaviour.emotionAt(performance.now()).name');
    if (emo !== 'happy') problems.push(`claude desktop: el avatar no puso cara «happy» (${emo})`);

    // Ajustes → Conectores muestra la tarjeta con Claude conectado.
    const settings = api.openWindow('settings');
    await waitForWindow(settings, 'document.querySelector("#view h1")');
    await settings.webContents.executeJavaScript(`document.querySelector('[data-tab="connectors"]').click()`);
    await waitForWindow(settings, `document.querySelector('#view .card .result.ok')?.textContent.includes('Claude Desktop')`, 5000).catch(() => problems.push('claude desktop: la tarjeta de Ajustes no muestra la conexión'));
  } catch (e) {
    problems.push(`claude desktop: ${e.message}`);
  } finally {
    await client.close().catch(() => {});
    api.patchConfig({ activeProfileId: prevProfile });
    await api.desktopMcp.sync();
  }
}
