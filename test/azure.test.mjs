import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../src/shared/i18n/index.js';
import { azurePolicyFor, contentFilterMessage } from '../src/main/llm/azure.js';
import { DEFAULT_FILTERS } from '../src/shared/personas.js';

const POLICIES = { strict: 'waifudesk-strict', standard: 'waifudesk-standard', relaxed: 'waifudesk-relaxed', unfiltered: '' };
const prof = (over = {}) => ({ kind: 'openai', auth: 'api-key', azurePolicyMode: 'auto', azurePolicies: { ...POLICIES }, ...over });
const f = (over = {}) => ({ ...DEFAULT_FILTERS, ...over });

test('azurePolicyFor: modo automático según los filtros', () => {
  assert.equal(azurePolicyFor(prof(), f()), 'waifudesk-standard');
  assert.equal(azurePolicyFor(prof(), f({ sexual: 'suggestive' })), 'waifudesk-relaxed');
  assert.equal(azurePolicyFor(prof(), f({ violence: 'free' })), 'waifudesk-relaxed');
  assert.equal(azurePolicyFor(prof(), f({ language: 'avoid', violence: 'avoid', sexual: 'off' })), 'waifudesk-strict');
  assert.equal(azurePolicyFor(prof(), f({ sexual: 'explicit' })), 'waifudesk-relaxed', 'sin política sin filtros, la permisiva');
  assert.equal(azurePolicyFor(prof({ azurePolicies: { ...POLICIES, unfiltered: 'mi-sin-filtros' } }), f({ sexual: 'explicit' })), 'mi-sin-filtros');
});

test('azurePolicyFor: fija, apagada y nombres vacíos', () => {
  assert.equal(azurePolicyFor(prof({ azurePolicyMode: 'fixed', azurePolicyFixed: 'otra' }), f({ sexual: 'explicit' })), 'otra');
  assert.equal(azurePolicyFor(prof({ azurePolicyMode: 'off' }), f()), null);
  assert.equal(azurePolicyFor(prof({ azurePolicies: { ...POLICIES, standard: '' } }), f()), null);
  assert.equal(azurePolicyFor({ kind: 'openai' }, f()), null, 'perfiles que no son de Azure');
});

test('contentFilterMessage: error 400 de Azure y fin por filtro', () => {
  setLocale('es');
  const body = {
    error: {
      message: "The response was filtered due to the prompt triggering Azure OpenAI's content management policy.",
      code: 'content_filter',
      status: 400,
      innererror: { code: 'ResponsibleAIPolicyViolation', content_filter_result: { hate: { filtered: false, severity: 'safe' }, sexual: { filtered: true, severity: 'medium' }, violence: { filtered: false, severity: 'safe' } } },
    },
  };
  assert.match(contentFilterMessage(body), /Azure/);
  assert.match(contentFilterMessage(body), /sexual/);
  const chunk = { choices: [{ finish_reason: 'content_filter', content_filter_results: { violence: { filtered: true, severity: 'high' } } }] };
  assert.match(contentFilterMessage(chunk), /violence/);
  assert.equal(contentFilterMessage({ error: { message: 'otra cosa' } }), null);
});
