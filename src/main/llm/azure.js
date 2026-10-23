// Azure OpenAI: qué política de contenido (filtro de Azure) se pide en cada petición con la cabecera
// x-policy-id, y un mensaje claro cuando Azure bloquea algo por su filtro.
import { t } from '../../shared/i18n/index.js';

const ADULT = ['suggestive', 'explicit'];

// profile.azurePolicyMode: 'auto' (según los filtros del personaje) | 'fixed' | 'off'
export function azurePolicyFor(profile, filters) {
  const policies = profile?.azurePolicies;
  if (!policies) return null;
  const mode = profile.azurePolicyMode || 'auto';
  if (mode === 'off') return null;
  if (mode === 'fixed') return profile.azurePolicyFixed?.trim() || null;
  let level = 'standard';
  if (filters.sexual === 'explicit' && policies.unfiltered?.trim()) level = 'unfiltered';
  else if (ADULT.includes(filters.sexual) || filters.violence === 'free') level = 'relaxed';
  else if (filters.sexual === 'off' && filters.violence === 'avoid' && filters.language === 'avoid') level = 'strict';
  return policies[level]?.trim() || null;
}

const filteredCategories = (results) =>
  Object.entries(results || {})
    .filter(([, v]) => v && v.filtered)
    .map(([k]) => k);

// Acepta el cuerpo JSON de un error HTTP o un fragmento SSE; null si no es un bloqueo por filtro.
export function contentFilterMessage(source) {
  if (!source || typeof source !== 'object') return null;
  let cats = null;
  const err = source.error;
  if (err && (err.code === 'content_filter' || err.innererror?.code === 'ResponsibleAIPolicyViolation')) cats = filteredCategories(err.innererror?.content_filter_result);
  const choice = source.choices?.[0];
  if (choice?.finish_reason === 'content_filter') cats = filteredCategories(choice.content_filter_results);
  if (!cats) return null;
  return cats.length ? t('errors.contentFilter', { categories: cats.join(', ') }) : t('errors.contentFilterUnknown');
}
