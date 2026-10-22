/*
檔案用途：提供完全虛構且可重播的 GitHub 證據；所在層：測試資料。
主要關聯：unit tests；不使用來源專案的帳號、營運資料或憑證。
*/
import type { Snapshot } from '../src/model.ts';
import type { Policy } from '../src/policy.ts';
import type { Runner } from '../src/github.ts';
export const HEAD = 'a'.repeat(40);
export const BASE = 'b'.repeat(40);
export function policy(): Policy {
  return { schemaVersion: 1, baseBranches: ['main'], releaseBranches: [],
    requiredChecks: [{ name: 'test', appId: 15368 }],
    review: { kind: 'approval', logins: ['reviewer-example'], minimum: 1 }, mergeMethod: 'squash' };
}
export function snapshot(): Snapshot {
  return { schemaVersion: 1, repository: 'example/project', number: 7, author: 'author-example',
    state: 'OPEN', draft: false, head: HEAD, headBranch: 'feature/example', base: BASE, baseBranch: 'main',
    mergeable: 'MERGEABLE', mergeState: 'CLEAN', lastBaseChange: null,
    checks: [{ name: 'test', state: 'SUCCESS', appId: 15368 }],
    reviews: [{ login: 'reviewer-example', state: 'APPROVED', commit: HEAD, body: '', at: '2026-01-02T00:00:00.000Z' }],
    threads: [], dependents: [] };
}
export function revision(s = snapshot()) {
  return { number: s.number, author: { login: s.author }, state: s.state, isDraft: s.draft, isCrossRepository: false,
    headRefOid: s.head, headRefName: s.headBranch, baseRefOid: s.base, baseRefName: s.baseBranch,
    mergeable: s.mergeable, mergeStateStatus: s.mergeState };
}
export function fakeGitHub(s = snapshot()): { run: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const run: Runner = (args) => {
    calls.push(args);
    const endpoint = args[0]!;
    if (endpoint === 'graphql') {
      const query = args.find((a) => a.startsWith('query='))!;
      if (query.includes('reviewThreads(')) return { data: { repository: { pullRequest: {
        reviewThreads: { nodes: s.threads.map((t) => ({ id: t.id, isResolved: t.resolved, path: t.path })), pageInfo: { hasNextPage: false, endCursor: null } },
      } } } };
      if (query.includes('timelineItems(')) return { data: { repository: { pullRequest: {
        timelineItems: { nodes: s.lastBaseChange ? [{ __typename: 'BaseRefChangedEvent', createdAt: s.lastBaseChange }] : [], pageInfo: { hasNextPage: false, endCursor: null } },
      } } } };
      return { data: { repository: { nameWithOwner: s.repository, pullRequest: revision(s) } } };
    }
    if (endpoint.includes('/reviews?')) return [s.reviews.map((r) => ({ user: { login: r.login }, state: r.state, commit_id: r.commit, body: r.body, submitted_at: r.at }))];
    if (endpoint.includes('/comments?')) return [[]];
    if (endpoint.includes('/check-runs?')) return [{ check_runs: s.checks.filter((c) => c.appId !== null).map((c) => ({ name: c.name, status: 'completed', conclusion: c.state.toLowerCase(), app: { id: c.appId } })) }];
    if (endpoint.includes('/statuses?')) return [s.checks.filter((c) => c.appId === null).map((c) => ({ context: c.name, state: c.state.toLowerCase() }))];
    if (endpoint.includes('/pulls?')) return [s.dependents.map((number) => ({ number }))];
    if (endpoint.includes('/statuses/') && args.includes('POST')) return {};
    throw new Error(`Unexpected test endpoint: ${endpoint}`);
  };
  return { run, calls };
}
