// «Ver la pantalla»: captura y se la pasa al modelo como imagen. Pide permiso (se puede dar para
// siempre) y solo aparece si el modelo activo tiene visión.
import { saveImageAttachment } from '../attachments.js';
import { t, localeTag } from '../../shared/i18n/index.js';

export function screenTools(cfg, services) {
  const profile = cfg.profiles?.find((p) => p.id === cfg.activeProfileId) || cfg.profiles?.[0];
  if (!services.captureScreen || profile?.vision === false) return [];
  return [
    {
      name: 'screen_capture',
      group: "see the user's screen",
      description:
        "Takes a screenshot of the user's screen (target 'screen', the one with the mouse) or of the window on top ('window') and shows it to you. Use it when the user asks you to look at something, to help with what is on screen, or to read an error they see.",
      schema: { type: 'object', properties: { target: { type: 'string', enum: ['screen', 'window'] } } },
      confirm: () => ({ title: t('confirm.screen.title'), message: t('confirm.screen.message'), detail: t('confirm.screen.detail') }),
      run: async ({ target = 'screen' } = {}) => {
        const shot = await services.captureScreen({ target: target === 'window' ? 'window' : 'screen' });
        const name = t('chat.screenshotName', { time: new Date().toLocaleTimeString(localeTag(), { timeStyle: 'short' }) });
        const att = saveImageAttachment(shot.buffer, shot.mime, name);
        return { content: `Screenshot attached (${shot.width}x${shot.height}).`, images: [att] };
      },
    },
  ];
}
