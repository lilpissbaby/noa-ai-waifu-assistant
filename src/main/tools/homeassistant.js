// Home Assistant: estado de luces, sensores, enchufes… y acciones (servicios) con confirmación.
// Token de larga duración (Perfil → Seguridad → Tokens) en el secreto «homeassistant».
import { jsonRequest } from './util.js';
import { getSecret } from '../config.js';
import { t } from '../../shared/i18n/index.js';

export function haApi(ha = {}, token = getSecret('homeassistant')) {
  const base = String(ha.baseUrl || '').replace(/\/+$/, '').replace(/\/api$/, '');
  if (!base) throw new Error('Home Assistant URL is not set.');
  const call = (method, p, body) => jsonRequest(`${base}/api${p}`, { method, body, label: 'Home Assistant', timeoutMs: 20000, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { call, base };
}

export async function testHomeAssistant(ha) {
  if (!getSecret('homeassistant')) return { ok: false, message: t('ha.noToken') };
  try {
    const api = haApi(ha);
    const [cfg, states] = await Promise.all([api.call('GET', '/config'), api.call('GET', '/states')]);
    return { ok: true, message: t('ha.ok', { name: cfg.location_name || 'Home Assistant', version: cfg.version || '?', count: states.length }) };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

const stateView = (s) => ({
  entity: s.entity_id,
  name: s.attributes?.friendly_name,
  state: s.state,
  ...(s.attributes?.unit_of_measurement ? { unit: s.attributes.unit_of_measurement } : {}),
  ...(s.attributes?.brightness != null ? { brightness: Math.round((s.attributes.brightness / 255) * 100) + '%' } : {}),
  ...(s.attributes?.current_temperature != null ? { currentTemperature: s.attributes.current_temperature } : {}),
  ...(s.attributes?.temperature != null && s.entity_id.startsWith('climate.') ? { target: s.attributes.temperature } : {}),
});

export function homeAssistantTools(cfg) {
  const ha = cfg.connectors?.homeassistant;
  if (!ha?.enabled || !ha.baseUrl) return [];
  const group = 'Home Assistant (smart home)';
  return [
    {
      name: 'ha_states',
      group,
      description:
        'States of Home Assistant entities (lights, switches, sensors, climate, covers, media players…). Filter by domain (light, switch, sensor, climate, cover, media_player, binary_sensor…) and/or search (text in the entity id or friendly name). Returns up to 80.',
      schema: { type: 'object', properties: { domain: { type: 'string' }, search: { type: 'string' } } },
      run: async ({ domain, search } = {}) => {
        const all = await haApi(ha).call('GET', '/states');
        const q = String(search || '').toLowerCase();
        const list = all.filter((s) => (!domain || s.entity_id.startsWith(`${domain}.`)) && (!q || `${s.entity_id} ${s.attributes?.friendly_name || ''}`.toLowerCase().includes(q)));
        return { count: list.length, entities: list.slice(0, 80).map(stateView) };
      },
    },
    {
      name: 'ha_call_service',
      group,
      description:
        'Runs a Home Assistant action, e.g. domain "light" service "turn_on" with entity_id "light.salon" and data {"brightness_pct": 40}; "switch.turn_off"; "climate.set_temperature" with data {"temperature": 21}; "script.turn_on"; "scene.turn_on". Look up entity ids with ha_states first. Asks the user first.',
      schema: {
        type: 'object',
        properties: { domain: { type: 'string' }, service: { type: 'string' }, entity_id: { type: 'string' }, data: { type: 'object', description: 'Extra service data.' } },
        required: ['domain', 'service'],
      },
      confirm: ({ domain, service, entity_id: entity }) => ({ title: t('approve.ha.title'), message: t('approve.ha.message', { action: `${domain}.${service}`, entity: entity || '—' }), detail: '' }),
      run: async ({ domain, service, entity_id: entity, data = {} }) => {
        if (!/^[a-z_]+$/.test(String(domain)) || !/^[a-z_]+$/.test(String(service))) throw new Error('Invalid domain or service.');
        const changed = await haApi(ha).call('POST', `/services/${domain}/${service}`, { ...(data && typeof data === 'object' ? data : {}), ...(entity ? { entity_id: entity } : {}) });
        return { ok: true, changed: (changed || []).slice(0, 20).map(stateView) };
      },
    },
  ];
}
