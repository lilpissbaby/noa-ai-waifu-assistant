// GitHub: notificaciones, issues y pull requests, CI (GitHub Actions) y crear issues o
// comentarios (con confirmación). Token personal en el secreto «github».
import { jsonRequest, compact } from './util.js';
import { getSecret } from '../config.js';
import { t } from '../../shared/i18n/index.js';

export const GITHUB_API = 'https://api.github.com';
const REPO = /^[\w.-]+\/[\w.-]+$/;

export function githubApi(gh = {}, token = getSecret('github')) {
  const base = String(gh.apiUrl || GITHUB_API).replace(/\/+$/, '');
  const call = (method, p, body, opts = {}) =>
    jsonRequest(`${base}${p}`, {
      method,
      body,
      label: 'GitHub',
      timeoutMs: 30000,
      ...opts,
      headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'WaifuDesk', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
  return { call, base };
}

export const checkRepo = (repo) => {
  const r = String(repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  if (!REPO.test(r)) throw new Error(`Repository must look like owner/name, got "${repo}".`);
  return r;
};

const issueView = (i) => ({
  repo: i.repository_url?.split('/repos/')[1],
  number: i.number,
  title: i.title,
  state: i.state,
  kind: i.pull_request ? 'pull request' : 'issue',
  author: i.user?.login,
  labels: (i.labels || []).map((l) => l.name),
  comments: i.comments,
  updated: i.updated_at,
  url: i.html_url,
});

const runView = (r) => ({
  workflow: r.name,
  title: r.display_title,
  run: r.run_number,
  branch: r.head_branch,
  event: r.event,
  status: r.status,
  conclusion: r.conclusion,
  started: r.run_started_at || r.created_at,
  url: r.html_url,
});

export async function testGithub(gh) {
  const token = getSecret('github');
  if (!token) return { ok: false, message: t('github.noToken') };
  try {
    const me = await githubApi(gh, token).call('GET', '/user');
    return { ok: true, message: t('github.ok', { login: me.login }) };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export function githubTools(cfg) {
  const gh = cfg.connectors?.github;
  if (!gh?.enabled) return [];
  const api = () => githubApi(gh);
  const group = 'GitHub';
  const watched = (gh.watchRepos || []).filter(Boolean);
  return [
    {
      name: 'github_notifications',
      group,
      description: "The user's unread GitHub notifications (mentions, review requests, CI, issues). all=true includes read ones.",
      schema: { type: 'object', properties: { all: { type: 'boolean' } } },
      run: async ({ all = false } = {}) => {
        const list = await api().call('GET', `/notifications?per_page=30${all ? '&all=true' : ''}`);
        return list.map((n) => ({ repo: n.repository?.full_name, type: n.subject?.type, title: n.subject?.title, reason: n.reason, unread: n.unread, updated: n.updated_at }));
      },
    },
    {
      name: 'github_search',
      group,
      description:
        'Searches issues and pull requests with GitHub search syntax, e.g. "is:open is:pr review-requested:@me", "is:open is:issue assignee:@me", "repo:owner/name is:open label:bug". Returns up to 30.',
      schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      run: async ({ query }) => {
        const r = await api().call('GET', `/search/issues?per_page=30&q=${encodeURIComponent(query)}`);
        return { total: r.total_count, items: (r.items || []).map(issueView) };
      },
    },
    {
      name: 'github_issue',
      group,
      description: 'Reads an issue or pull request with its latest comments.',
      schema: { type: 'object', properties: { repo: { type: 'string', description: 'owner/name' }, number: { type: 'number' } }, required: ['repo', 'number'] },
      run: async ({ repo, number }) => {
        const r = checkRepo(repo);
        const [issue, comments] = await Promise.all([api().call('GET', `/repos/${r}/issues/${Number(number)}`), api().call('GET', `/repos/${r}/issues/${Number(number)}/comments?per_page=20`)]);
        return compact({ ...issueView(issue), body: issue.body, comments: comments.slice(-15).map((c) => ({ author: c.user?.login, at: c.created_at, body: c.body })) });
      },
    },
    {
      name: 'github_repo',
      group,
      description: 'Overview of a repository: description, default branch, stars, open issues, last push, latest release and open pull requests.',
      schema: { type: 'object', properties: { repo: { type: 'string' } }, required: ['repo'] },
      run: async ({ repo }) => {
        const r = checkRepo(repo);
        const [info, pulls, release] = await Promise.all([
          api().call('GET', `/repos/${r}`),
          api().call('GET', `/repos/${r}/pulls?state=open&per_page=15`),
          api()
            .call('GET', `/repos/${r}/releases/latest`)
            .catch(() => null),
        ]);
        return compact({
          repo: info.full_name,
          description: info.description,
          private: info.private,
          defaultBranch: info.default_branch,
          stars: info.stargazers_count,
          openIssuesAndPrs: info.open_issues_count,
          pushed: info.pushed_at,
          url: info.html_url,
          latestRelease: release ? { tag: release.tag_name, name: release.name, published: release.published_at } : undefined,
          openPullRequests: pulls.map((p) => ({ number: p.number, title: p.title, author: p.user?.login, draft: p.draft, updated: p.updated_at })),
        });
      },
    },
    {
      name: 'github_ci',
      group,
      description: `Latest GitHub Actions runs of a repository${watched.length ? ` (watched: ${watched.join(', ')})` : ''}: workflow, branch, status and conclusion. Optional branch.`,
      schema: { type: 'object', properties: { repo: { type: 'string' }, branch: { type: 'string' } }, required: ['repo'] },
      run: async ({ repo, branch }) => {
        const r = checkRepo(repo);
        const res = await api().call('GET', `/repos/${r}/actions/runs?per_page=10${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`);
        return (res.workflow_runs || []).map(runView);
      },
    },
    {
      name: 'github_create_issue',
      group,
      description: 'Creates an issue in a repository. Asks the user first.',
      schema: { type: 'object', properties: { repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } } }, required: ['repo', 'title'] },
      confirm: ({ repo, title }) => ({ title: t('approve.github.title'), message: t('approve.github.issue', { repo: String(repo || ''), title: String(title || '') }), detail: '' }),
      run: async ({ repo, title, body = '', labels }) => {
        const i = await api().call('POST', `/repos/${checkRepo(repo)}/issues`, { title, body, ...(labels?.length ? { labels } : {}) });
        return { number: i.number, url: i.html_url };
      },
    },
    {
      name: 'github_comment',
      group,
      description: 'Adds a comment to an issue or pull request. Asks the user first.',
      schema: { type: 'object', properties: { repo: { type: 'string' }, number: { type: 'number' }, body: { type: 'string' } }, required: ['repo', 'number', 'body'] },
      confirm: ({ repo, number, body }) => ({ title: t('approve.github.title'), message: t('approve.github.comment', { repo: String(repo || ''), number: String(number || '') }), detail: String(body || '').slice(0, 600) }),
      run: async ({ repo, number, body }) => {
        const c = await api().call('POST', `/repos/${checkRepo(repo)}/issues/${Number(number)}/comments`, { body });
        return { url: c.html_url };
      },
    },
  ];
}

// Para el vigilante de CI: últimas ejecuciones de la rama principal.
export async function latestRuns(gh, repo) {
  const api = githubApi(gh);
  const r = checkRepo(repo);
  const res = await api.call('GET', `/repos/${r}/actions/runs?per_page=10&exclude_pull_requests=true`);
  return res.workflow_runs || [];
}
