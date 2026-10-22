/*
檔案用途：透過既有 gh 登入取得完整 GitHub 證據；所在層：外部 API adapter。
主要關聯：model.ts、gate.ts、delivery.ts；固定 github.com 並以 argv 呼叫，避免 shell 注入。
*/
import { spawnSync } from 'node:child_process';
import { array, boolean, InputError, object, parseSnapshot, repository, sha, type Snapshot } from './model.ts';
import { reviewedCommit, sameRevision } from './gate.ts';
import type { Policy } from './policy.ts';

export type Runner = (args: string[]) => unknown;
export class OperationError extends Error {
  constructor(public code: 'github' | 'changed' | 'publicationUnknown' | 'blocked' | 'expectedHead') { super(code); this.name = 'OperationError'; }
}
export function runGh(args: string[]): unknown {
  const result = spawnSync('gh', ['api', '--hostname', 'github.com', ...args], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' },
  });
  // 錯誤內容可能含遠端正文或本機憑證診斷，不原樣貼進公開報告。
  if (result.error || result.status !== 0) throw new OperationError('github');
  try { return JSON.parse(result.stdout); } catch { throw new OperationError('github'); }
}
const PR_FIELDS = 'number author { login } state isDraft isCrossRepository headRefOid headRefName baseRefOid baseRefName mergeable mergeStateStatus';
const PR_QUERY = `query($owner:String!,$name:String!,$number:Int!){ repository(owner:$owner,name:$name){ nameWithOwner pullRequest(number:$number){ ${PR_FIELDS} } } }`;
function gql(run: Runner, query: string, variables: Record<string, string | number>): Record<string, unknown> {
  const args = ['graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) args.push(typeof value === 'number' ? '-F' : '-f', `${key}=${value}`);
  const response = object(run(args), 'graphql');
  if (response.errors) throw new OperationError('github');
  return object(response.data, 'graphql.data');
}
function variables(repo: string, number: number): { owner: string; name: string; number: number } {
  const [owner, name] = repository(repo).split('/');
  if (!Number.isSafeInteger(number) || number < 1) throw new InputError('number');
  return { owner: owner!, name: name!, number };
}
export function readRevision(run: Runner, repo: string, number: number): Record<string, unknown> {
  const data = gql(run, PR_QUERY, variables(repo, number));
  const result = object(data.repository, 'repository');
  if (typeof result.nameWithOwner !== 'string' || result.nameWithOwner.toLowerCase() !== repo.toLowerCase()) throw new OperationError('github');
  const pr = object(result.pullRequest, 'pullRequest');
  sha(pr.headRefOid, 'headRefOid'); sha(pr.baseRefOid, 'baseRefOid');
  if (pr.number !== number) throw new OperationError('github');
  return pr;
}
function restPages(run: Runner, endpoint: string, key?: string): Record<string, unknown>[] {
  const pages = array(run([endpoint, '--paginate', '--slurp']), 'pages');
  return pages.flatMap((page) => array(key ? object(page, 'page')[key] : page, 'page').map((item) => object(item, 'item')));
}
// 每次只查一條 connection，完整分頁；缺游標、重複游標與過量回應都停止，而不是把截斷當成沒有問題。
function connection(run: Runner, repo: string, number: number, name: string, selection: string): Record<string, unknown>[] {
  const query = `query($owner:String!,$name:String!,$number:Int!,$cursor:String){ repository(owner:$owner,name:$name){ pullRequest(number:$number){ ${name}(first:100,after:$cursor){ nodes{ ${selection} } pageInfo{hasNextPage endCursor} } } } }`;
  let cursor: string | undefined;
  const seen = new Set<string>();
  const nodes: Record<string, unknown>[] = [];
  for (let page = 0; page < 100; page++) {
    const vars: Record<string, string | number> = variables(repo, number);
    if (cursor) vars.cursor = cursor;
    const data = gql(run, query, vars);
    const pr = object(object(data.repository, 'repository').pullRequest, 'pullRequest');
    const result = object(pr[name], name);
    nodes.push(...array(result.nodes, 'nodes').map((n) => object(n, 'node')));
    const info = object(result.pageInfo, 'pageInfo');
    if (info.hasNextPage === false) return nodes;
    if (info.hasNextPage !== true || typeof info.endCursor !== 'string' || !info.endCursor || seen.has(info.endCursor)) throw new OperationError('github');
    cursor = info.endCursor; seen.add(cursor);
  }
  throw new OperationError('github');
}
export function collectSnapshot(run: Runner, repo: string, number: number, policy: Policy): Snapshot {
  const first = readRevision(run, repo, number);
  const head = sha(first.headRefOid, 'headRefOid');
  const endpoint = `repos/${repository(repo)}`;
  const reviews = restPages(run, `${endpoint}/pulls/${number}/reviews?per_page=100`)
    .filter((r) => r.state !== 'PENDING')
    .map((r) => ({ login: object(r.user, 'review.user').login, state: r.state,
      commit: r.commit_id, body: r.body ?? '', at: r.submitted_at }));
  if (policy.review.kind === 'codex') {
    const resolved = new Map<string, string>();
    for (const comment of restPages(run, `${endpoint}/issues/${number}/comments?per_page=100`)) {
      const login = object(comment.user, 'comment.user').login;
      if (typeof login !== 'string' || !policy.review.logins.includes(login.toLowerCase()) || typeof comment.body !== 'string') continue;
      const short = reviewedCommit(comment.body);
      if (!short || !head.startsWith(short)) continue;
      // 縮寫必須由 GitHub 解析成唯一完整 SHA，不能靠字首碰巧相同就放行。
      if (!resolved.has(short)) resolved.set(short, sha(object(run([`${endpoint}/commits/${short}`]), 'commit').sha, 'commit.sha'));
      if (resolved.get(short) === head) reviews.push({ login, state: 'COMMENTED', commit: head, body: comment.body, at: comment.created_at });
    }
  }
  const threads = connection(run, repo, number, 'reviewThreads', 'id isResolved path');
  const timeline = connection(run, repo, number, 'timelineItems', '__typename ... on BaseRefChangedEvent { createdAt }');
  const dates = timeline.filter((e) => e.__typename === 'BaseRefChangedEvent').map((e) => String(e.createdAt)).sort();
  const checks = restPages(run, `${endpoint}/commits/${head}/check-runs?filter=latest&per_page=100`, 'check_runs');
  const statuses = restPages(run, `${endpoint}/commits/${head}/statuses?per_page=100`);
  const latestStatuses = new Map<string, Record<string, unknown>>();
  for (const status of statuses) {
    const context = String(status.context);
    if (!latestStatuses.has(context)) latestStatuses.set(context, status);
  }
  // fork 的同名分支不是本 repo 的分支，不能把 main 上所有 PR（甚至自己）誤認為下游。
  const children = boolean(first.isCrossRepository, 'isCrossRepository') ? [] :
    restPages(run, `${endpoint}/pulls?state=open&base=${encodeURIComponent(String(first.headRefName))}&per_page=100`).filter((c) => c.number !== number);
  const snapshot = parseSnapshot({
    schemaVersion: 1, repository: repo, number, author: object(first.author, 'author').login,
    state: first.state, draft: first.isDraft, head, headBranch: first.headRefName,
    base: first.baseRefOid, baseBranch: first.baseRefName, mergeable: first.mergeable, mergeState: first.mergeStateStatus,
    lastBaseChange: dates.at(-1) ?? null,
    reviews, threads: threads.map((t) => ({ id: t.id, resolved: t.isResolved, path: t.path })),
    checks: [
      ...checks.map((c) => ({ name: c.name, state: c.status === 'completed' ? String(c.conclusion).toUpperCase() : 'PENDING', appId: object(c.app, 'check.app').id })),
      ...[...latestStatuses.values()].map((s) => ({ name: s.context, state: String(s.state).toUpperCase(), appId: null })),
    ],
    dependents: children.map((c) => c.number),
  });
  const last = readRevision(run, repo, number);
  if (last.headRefOid !== snapshot.head || last.baseRefOid !== snapshot.base || last.baseRefName !== snapshot.baseBranch || last.state !== snapshot.state || last.isDraft !== snapshot.draft) throw new OperationError('changed');
  return snapshot;
}

export function publishStatus(run: Runner, snapshot: Pick<Snapshot, 'repository' | 'head' | 'number'>, state: 'pending' | 'success' | 'failure' | 'error', description: string): void {
  // 每張 PR 一個 context，避免兩張同 head、不同 base 的 PR 互相蓋過結果。
  run([`repos/${repository(snapshot.repository)}/statuses/${sha(snapshot.head, 'head')}`, '--method', 'POST',
    '-f', `state=${state}`, '-f', `context=reviewlatch/pr-${snapshot.number}`, '-f', `description=${description.slice(0, 140)}`]);
}

export { sameRevision };
