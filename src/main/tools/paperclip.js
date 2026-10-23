// Conector para Paperclip (orquestación de agentes de IA). Docs: https://docs.paperclip.ing
import { getSecret } from '../config.js';
import { compact, jsonRequest, pick } from './util.js';
import { t } from '../../shared/i18n/index.js';
import { assistantName } from '../../shared/personas.js';

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

const issueLabel = (i) => [i?.identifier, i?.title].filter(Boolean).join(' · ');

// services.watchIssue(id, estado, etiqueta): las tareas creadas o comentadas se vigilan para avisar.
export function paperclipTools(cfg, services = {}) {
  const pc = cfg.connectors.paperclip;
  if (!pc?.enabled || !pc.baseUrl || !pc.companyId) return [];
  const { call, companyPath } = paperclipApi(pc);
  const group = 'manage tasks and AI agents in Paperclip';
  const listOf = (r) => (Array.isArray(r) ? r : r?.items || r?.data || r?.issues || r?.agents || r?.projects || []);

  return [
    {
      name: 'paperclip_list_agents',
      group,
      description: "Lists the company's AI agents in Paperclip (id, name, role, status). Use it to find out who to assign work to.",
      schema: { type: 'object', properties: {} },
      run: async (_, { signal }) => listOf(await call('GET', companyPath('/agents'), undefined, signal)).map(agentSummary),
    },
    {
      name: 'paperclip_list_projects',
      group,
      description: "Lists the company's projects in Paperclip.",
      schema: { type: 'object', properties: {} },
      run: async (_, { signal }) =>
        listOf(await call('GET', companyPath('/projects'), undefined, signal)).map((p) => pick(p, ['id', 'name', 'status', 'description'])),
    },
    {
      name: 'paperclip_list_issues',
      group,
      description: 'Lists Paperclip tasks (issues), optionally filtered by status, assigned agent or project.',
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: `Comma-separated statuses: ${STATUSES.join(', ')}` },
          assigneeAgentId: { type: 'string' },
          projectId: { type: 'string' },
          limit: { type: 'number', description: 'Maximum number of results (default 25)' },
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
      description: 'Gets the details of a Paperclip task and its latest comments.',
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
        "Creates a task in Paperclip and optionally assigns it to an agent, to delegate work to the user's AI agents. Call paperclip_list_agents first if you don't know the agent id.",
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', description: 'Markdown description with acceptance criteria' },
          priority: { type: 'string', enum: PRIORITIES },
          status: { type: 'string', enum: ['backlog', 'todo'], description: 'todo to start right away; backlog for later' },
          assigneeAgentId: { type: 'string' },
          projectId: { type: 'string' },
          parentId: { type: 'string', description: 'Parent task id if this is a subtask' },
        },
        required: ['title'],
      },
      confirm: (i) => ({
        title: t('confirm.paperclip.createTitle'),
        message: t(i.assigneeAgentId ? 'confirm.paperclip.createAssign' : 'confirm.paperclip.create', { title: i.title }),
        detail: (i.description || '').slice(0, 600),
        allowAlways: true,
      }),
      run: async (input, { signal }) => {
        const body = pick(input, ['title', 'description', 'priority', 'status', 'assigneeAgentId', 'projectId', 'parentId']);
        if (!body.status) body.status = 'todo';
        const issue = issueSummary(await call('POST', companyPath('/issues'), body, signal));
        if (issue.id) services.watchIssue?.(issue.id, issue.status || body.status, issueLabel(issue));
        return issue;
      },
    },
    {
      name: 'paperclip_update_issue',
      group,
      description: 'Updates a Paperclip task: status, priority, assignee, title or description, and optionally adds a comment.',
      schema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          status: { type: 'string', enum: STATUSES },
          priority: { type: 'string', enum: PRIORITIES },
          assigneeAgentId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          comment: { type: 'string', description: 'Comment to add in the same call' },
        },
        required: ['issueId'],
      },
      confirm: (i) => ({
        title: t('confirm.paperclip.updateTitle'),
        message: t('confirm.paperclip.update', { id: i.issueId }),
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
      description: 'Adds a (markdown) comment to a Paperclip task, for example to give an agent instructions.',
      schema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          body: { type: 'string' },
          reopen: { type: 'boolean', description: 'Reopen it if it was done/cancelled' },
        },
        required: ['issueId', 'body'],
      },
      confirm: (i) => ({ title: t('confirm.paperclip.commentTitle'), message: t('confirm.paperclip.comment', { id: i.issueId }), detail: String(i.body || '').slice(0, 600), allowAlways: true }),
      run: async ({ issueId, body, reopen }, { signal }) => {
        const r = compact(await call('POST', `/issues/${encodeURIComponent(issueId)}/comments`, { body, ...(reopen ? { reopen: true } : {}) }, signal));
        services.watchIssue?.(issueId, null, '');
        return r;
      },
    },
    {
      name: 'paperclip_watch',
      group,
      description: 'Watches a Paperclip task: the user gets a notice when it is done, blocked, needs review or is cancelled. Tasks you create or comment on are watched automatically.',
      schema: { type: 'object', properties: { issueId: { type: 'string' } }, required: ['issueId'] },
      run: async ({ issueId }, { signal }) => {
        const issue = await call('GET', `/issues/${encodeURIComponent(issueId)}`, undefined, signal);
        services.watchIssue?.(issue?.id || issueId, issue?.status || null, issueLabel(issue));
        return `Watching ${issueLabel(issue) || issueId} (status ${issue?.status || 'unknown'}). The user will be notified when it changes to done, blocked, in_review or cancelled.`;
      },
    },
    {
      name: 'paperclip_wakeup_agent',
      group,
      description: 'Wakes a Paperclip agent up so it runs a heartbeat now (for example after assigning it a task).',
      schema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          reason: { type: 'string' },
          issueId: { type: 'string', description: 'Task it should focus on (optional)' },
        },
        required: ['agentId'],
      },
      confirm: (i) => ({ title: t('confirm.paperclip.wakeTitle'), message: t('confirm.paperclip.wake', { id: i.agentId }), detail: i.reason || '', allowAlways: true }),
      run: async ({ agentId, reason, issueId }, { signal }) =>
        compact(
          await call(
            'POST',
            `/agents/${encodeURIComponent(agentId)}/wakeup`,
            {
              source: 'on_demand',
              triggerDetail: 'manual',
              reason: reason || `Requested from ${assistantName(cfg)}`,
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
    message: t('paperclip.connected', { count: list.length }),
    companies: list.map((c) => ({ id: c.id, name: c.name })),
  };
}
