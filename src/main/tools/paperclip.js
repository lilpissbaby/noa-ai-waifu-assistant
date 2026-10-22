// Conector para Paperclip (orquestación de agentes de IA). Docs: https://docs.paperclip.ing
import { getSecret } from '../config.js';
import { compact, jsonRequest, pick } from './util.js';

const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];

export function paperclipApi(pc) {
  const root = pc.baseUrl.replace(/\/+$/, '');
  const api = root.endsWith('/api') ? root : `${root}/api`;
  const key = getSecret('paperclip');
  const headers = key ? { authorization: `Bearer ${key}` } : {};
  const call = (method, p, body, signal) => jsonRequest(`${api}${p}`, { method, headers, body, signal, label: 'Paperclip' });
  return { api, call, companyPath: (p = '') => `/companies/${encodeURIComponent(pc.companyId)}${p}` };
}

const issueSummary = (i) =>
  pick(i, ['id', 'identifier', 'title', 'status', 'priority', 'assigneeAgentId', 'assigneeUserId', 'projectId', 'parentId', 'updatedAt']);
const agentSummary = (a) => pick(a, ['id', 'name', 'shortname', 'role', 'title', 'status', 'reportsTo', 'adapterType']);

export function paperclipTools(cfg) {
  const pc = cfg.connectors.paperclip;
  if (!pc?.enabled || !pc.baseUrl || !pc.companyId) return [];
  const { call, companyPath } = paperclipApi(pc);
  const group = 'gestionar tareas y agentes de IA en Paperclip';
  const listOf = (r) => (Array.isArray(r) ? r : r?.items || r?.data || r?.issues || r?.agents || r?.projects || []);

  return [
    {
      name: 'paperclip_list_agents',
      group,
      description: 'Lista los agentes de IA de la empresa en Paperclip (id, nombre, rol, estado). Úsalo para saber a quién asignar trabajo.',
      schema: { type: 'object', properties: {} },
      run: async (_, { signal }) => listOf(await call('GET', companyPath('/agents'), undefined, signal)).map(agentSummary),
    },
    {
      name: 'paperclip_list_projects',
      group,
      description: 'Lista los proyectos de la empresa en Paperclip.',
      schema: { type: 'object', properties: {} },
      run: async (_, { signal }) =>
        listOf(await call('GET', companyPath('/projects'), undefined, signal)).map((p) => pick(p, ['id', 'name', 'status', 'description'])),
    },
    {
      name: 'paperclip_list_issues',
      group,
      description: 'Lista tareas (issues) de Paperclip, filtrando opcionalmente por estado, agente asignado o proyecto.',
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: `Estados separados por coma: ${STATUSES.join(', ')}` },
          assigneeAgentId: { type: 'string' },
          projectId: { type: 'string' },
          limit: { type: 'number', description: 'Máximo de resultados (por defecto 25)' },
        },
      },
      run: async ({ status, assigneeAgentId, projectId, limit }, { signal }) => {
        const q = new URLSearchParams();
        if (status) q.set('status', status);
        if (assigneeAgentId) q.set('assigneeAgentId', assigneeAgentId);
        if (projectId) q.set('projectId', projectId);
        q.set('limit', String(Math.min(Number(limit) || 25, 100)));
        return listOf(await call('GET', companyPath(`/issues?${q}`), undefined, signal)).map(issueSummary);
      },
    },
    {
      name: 'paperclip_get_issue',
      group,
      description: 'Obtiene el detalle de una tarea de Paperclip y sus últimos comentarios.',
      schema: { type: 'object', properties: { issueId: { type: 'string' } }, required: ['issueId'] },
      run: async ({ issueId }, { signal }) => {
        const issue = await call('GET', `/issues/${encodeURIComponent(issueId)}`, undefined, signal);
        let comments = [];
        try {
          comments = listOf(await call('GET', `/issues/${encodeURIComponent(issueId)}/comments`, undefined, signal)).slice(-10);
        } catch {
          /* opcional */
        }
        return compact({ issue, comments: comments.map((c) => pick(c, ['authorAgentId', 'authorUserId', 'body', 'createdAt'])) });
      },
    },
    {
      name: 'paperclip_create_issue',
      group,
      description:
        'Crea una tarea en Paperclip y opcionalmente la asigna a un agente. Para delegar trabajo a los agentes de IA del usuario. Consulta antes paperclip_list_agents si no sabes el id del agente.',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', description: 'Descripción en markdown con criterios de aceptación' },
          priority: { type: 'string', enum: PRIORITIES },
          status: { type: 'string', enum: ['backlog', 'todo'], description: 'todo para que se trabaje ya; backlog para más adelante' },
          assigneeAgentId: { type: 'string' },
          projectId: { type: 'string' },
          parentId: { type: 'string', description: 'Id de la tarea padre si es una subtarea' },
        },
        required: ['title'],
      },
      confirm: (i) => ({
        title: 'Crear tarea en Paperclip',
        message: `¿Crear la tarea «${i.title}»${i.assigneeAgentId ? ' y asignarla a un agente' : ''}?`,
        detail: (i.description || '').slice(0, 600),
        allowAlways: true,
      }),
      run: async (input, { signal }) => {
        const body = pick(input, ['title', 'description', 'priority', 'status', 'assigneeAgentId', 'projectId', 'parentId']);
        if (!body.status) body.status = 'todo';
        return issueSummary(await call('POST', companyPath('/issues'), body, signal));
      },
    },
    {
      name: 'paperclip_update_issue',
      group,
      description: 'Actualiza una tarea de Paperclip: estado, prioridad, asignación, título o descripción, y opcionalmente añade un comentario.',
      schema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          status: { type: 'string', enum: STATUSES },
          priority: { type: 'string', enum: PRIORITIES },
          assigneeAgentId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          comment: { type: 'string', description: 'Comentario a añadir en la misma llamada' },
        },
        required: ['issueId'],
      },
      confirm: (i) => ({
        title: 'Actualizar tarea en Paperclip',
        message: `¿Modificar la tarea ${i.issueId}?`,
        detail: JSON.stringify(pick(i, ['status', 'priority', 'assigneeAgentId', 'title', 'comment']), null, 1),
        allowAlways: true,
      }),
      run: async ({ issueId, ...rest }, { signal }) => {
        const body = pick(rest, ['status', 'priority', 'assigneeAgentId', 'title', 'description', 'comment']);
        return issueSummary(await call('PATCH', `/issues/${encodeURIComponent(issueId)}`, body, signal));
      },
    },
    {
      name: 'paperclip_add_comment',
      group,
      description: 'Añade un comentario (markdown) a una tarea de Paperclip, por ejemplo para dar instrucciones a un agente.',
      schema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          body: { type: 'string' },
          reopen: { type: 'boolean', description: 'Reabrir si estaba done/cancelled' },
        },
        required: ['issueId', 'body'],
      },
      confirm: (i) => ({ title: 'Comentar en Paperclip', message: `¿Comentar en ${i.issueId}?`, detail: i.body.slice(0, 600), allowAlways: true }),
      run: async ({ issueId, body, reopen }, { signal }) =>
        compact(await call('POST', `/issues/${encodeURIComponent(issueId)}/comments`, { body, ...(reopen ? { reopen: true } : {}) }, signal)),
    },
    {
      name: 'paperclip_wakeup_agent',
      group,
      description: 'Despierta a un agente de Paperclip para que ejecute un heartbeat ahora (por ejemplo tras asignarle una tarea).',
      schema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          reason: { type: 'string' },
          issueId: { type: 'string', description: 'Tarea en la que debe centrarse (opcional)' },
        },
        required: ['agentId'],
      },
      confirm: (i) => ({ title: 'Despertar agente', message: `¿Despertar al agente ${i.agentId}?`, detail: i.reason || '', allowAlways: true }),
      run: async ({ agentId, reason, issueId }, { signal }) =>
        compact(
          await call(
            'POST',
            `/agents/${encodeURIComponent(agentId)}/wakeup`,
            {
              source: 'on_demand',
              triggerDetail: 'manual',
              reason: reason || `Solicitado desde ${cfg.assistant.name}`,
              ...(issueId ? { payload: { issueId } } : {}),
            },
            signal,
          ),
        ),
    },
  ];
}

export async function testPaperclip(pc) {
  const { call } = paperclipApi(pc);
  const companies = await call('GET', '/companies');
  const list = Array.isArray(companies) ? companies : companies?.items || companies?.data || [];
  return {
    message: `Conectado. ${list.length} empresa(s).`,
    companies: list.map((c) => ({ id: c.id, name: c.name })),
  };
}
