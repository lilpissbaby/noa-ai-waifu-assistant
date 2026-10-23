// Registro de herramientas + confirmaciones para acciones con efectos.
import { dialog } from 'electron';
import { builtinTools } from './builtin.js';
import { hermesTools } from './hermes.js';
import { paperclipTools } from './paperclip.js';
import { webhookTools } from './webhooks.js';
import { mcpTools } from './mcp.js';
import { personaTools } from './persona.js';
import { reminderTools } from './reminders.js';
import { memoryTools } from './memory.js';
import { noteTools } from './notes.js';
import { screenTools } from './screen.js';
import { loadConfig, patchConfig } from '../config.js';
import { t } from '../../shared/i18n/index.js';

// services: funciones de main.js que algunas herramientas necesitan (cambiar de personaje, abrir
// ventanas, avisar…). En los tests se pasan dobles.
export function buildToolbox(cfg, getParentWindow, services = {}) {
  const all = [...builtinTools(cfg), ...personaTools(cfg, services), ...(services.reminders ? reminderTools(services) : []),
    ...(cfg.productivity?.memory !== false ? memoryTools() : []),
    ...noteTools(cfg),
    ...screenTools(cfg, services),
    ...hermesTools(cfg), ...paperclipTools(cfg), ...webhookTools(cfg), ...mcpTools(cfg)];
  const byName = new Map(all.map((tool) => [tool.name, tool]));

  async function run(name, input, ctx) {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (tool.confirm) {
      const auto = loadConfig().tools.autoApprove?.[name];
      const spec = tool.confirm(input || {});
      // confirm() devuelve null cuando esa llamada concreta no necesita permiso.
      if (spec && !(auto && spec.allowAlways !== false)) {
        const always = spec.allowAlways !== false;
        const buttons = always ? [t('confirm.allow'), t('confirm.allowAlways'), t('confirm.deny')] : [t('confirm.allow'), t('confirm.deny')];
        const parent = getParentWindow?.();
        const opts = {
          type: 'question',
          buttons,
          defaultId: 0,
          cancelId: buttons.length - 1,
          title: spec.title || t('confirm.title'),
          message: spec.message || t('confirm.run', { name }),
          detail: spec.detail || '',
          noLink: true,
        };
        const { response } = parent && !parent.isDestroyed() ? await dialog.showMessageBox(parent, opts) : await dialog.showMessageBox(opts);
        if (response === buttons.length - 1) throw new Error(t('confirm.denied'));
        if (always && response === 1) patchConfig({ tools: { autoApprove: { [name]: true } } });
      }
    }
    return tool.run(input || {}, ctx || {});
  }

  return {
    list: all.map(({ name, description, schema, group }) => ({ name, description, schema, group })),
    run,
  };
}
