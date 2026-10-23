// Herramientas web: leer una página y, si hay buscador configurado, buscar.
import { fetchReadable, searchWeb, checkHttpUrl, isPrivateHost } from '../productivity/web.js';
import { getSecret } from '../config.js';
import { t } from '../../shared/i18n/index.js';

export function webTools(cfg, services = {}) {
  const search = cfg.productivity?.search || { provider: 'none' };
  const group = 'read web pages and search the web';
  const tools = [
    {
      name: 'web_fetch',
      group,
      description: 'Reads a web page or online PDF and returns its main text (up to 20,000 characters). Use it to read links the user shares or results from web_search.',
      schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      // La red local o el propio equipo (router, servicios caseros…) se leen solo con permiso.
      confirm: ({ url }) => {
        let u;
        try {
          u = checkHttpUrl(url);
        } catch {
          return null;
        }
        return isPrivateHost(u.hostname) ? { title: t('confirm.webLocal.title'), message: t('confirm.webLocal.message', { url: u.href }), detail: '' } : null;
      },
      run: async ({ url }) => fetchReadable(url),
    },
  ];
  if (search.provider && search.provider !== 'none')
    tools.push({
      name: 'web_search',
      group,
      description: 'Searches the web and returns titles, URLs and snippets. Then read the most relevant pages with web_fetch before answering, and cite the URLs you used.',
      schema: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'number', description: '1-10, default 5' } }, required: ['query'] },
      run: async ({ query, count }) => searchWeb(search, services.searchKey ?? getSecret('search'), query, count),
    });
  return tools;
}
