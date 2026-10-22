// Registro de herramientas + confirmaciones para acciones con efectos.
import { dialog } from 'electron';
import { builtinTools } from './builtin.js';
import { hermesTools } from './hermes.js';
import { paperclipTools } from './paperclip.js';
import { webhookTools } from './webhooks.js';
import { mcpTools } from './mcp.js';
import { loadConfig, patchConfig } from '../config.js';

export function buildToolbox(cfg, getParentWindow) {
  const all = [...builtinTools(cfg), ...hermesTools(cfg), ...paperclipTools(cfg), ...webhookTools(cfg), ...mcpTools(cfg)];
  const byName = new Map(all.map((t) => [t.name, t]));

  async function run(name, input, ctx) {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Herramienta desconocida: ${name}`);
    if (tool.confirm) {
      const auto = loadConfig().tools.autoApprove?.[name];
      const spec = tool.confirm(input || {});
      if (!(auto && spec.allowAlways !== false)) {
        const buttons = spec.allowAlways === false ? ['Permitir', 'Denegar'] : ['Permitir', 'Permitir siempre', 'Denegar'];
        const parent = getParentWindow?.();
        const opts = {
          type: 'question',
          buttons,
          defaultId: 0,
          cancelId: buttons.length - 1,
          title: spec.title || 'Confirmar acción',
          message: spec.message || `¿Ejecutar ${name}?`,
          detail: spec.detail || '',
          noLink: true,
        };
        const { response } = parent && !parent.isDestroyed() ? await dialog.showMessageBox(parent, opts) : await dialog.showMessageBox(opts);
        if (response === buttons.length - 1) throw new Error('El usuario ha denegado la acción');
        if (buttons[response] === 'Permitir siempre') patchConfig({ tools: { autoApprove: { [name]: true } } });
      }
    }
    return tool.run(input || {}, ctx || {});
  }

  return {
    list: all.map(({ name, description, schema, group }) => ({ name, description, schema, group })),
    run,
  };
}
