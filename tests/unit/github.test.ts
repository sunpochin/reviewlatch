/* 檔案用途：驗證分頁、來源與競態；所在層：adapter 測試；主要關聯：github.ts。 */
import { expect, test } from 'bun:test';
import { collectSnapshot, publishStatus, type Runner } from '../../src/github.ts';
import { object } from '../../src/model.ts';
import { HEAD, fakeGitHub, policy, snapshot } from '../fixtures.ts';

test('collects a complete API snapshot', () => {
  const fake = fakeGitHub();
  expect(collectSnapshot(fake.run, 'example/project', 7, policy())).toEqual(snapshot());
  expect(fake.calls.filter((a) => a[0] === 'graphql')).toHaveLength(4);
});
test('paginates threads including a blocker on the second page', () => {
  const fake = fakeGitHub(); let pages = 0;
  const run: Runner = (args) => {
    if (args.some((a) => a.includes('reviewThreads('))) {
      pages++;
      return { data: { repository: { pullRequest: { reviewThreads: {
        nodes: pages === 1 ? [] : [{ id: 'later-thread', isResolved: false, path: 'test.ts' }],
        pageInfo: { hasNextPage: pages === 1, endCursor: 'cursor-one' },
      } } } } };
    }
    return fake.run(args);
  };
  expect(collectSnapshot(run, 'example/project', 7, policy()).threads).toHaveLength(1);
  expect(pages).toBe(2);
});
test('rejects an incomplete or repeating cursor', () => {
  const fake = fakeGitHub();
  const run: Runner = (args) => args.some((a) => a.includes('reviewThreads('))
    ? { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'repeat' } } } } } }
    : fake.run(args);
  expect(() => collectSnapshot(run, 'example/project', 7, policy())).toThrow();
});
test('does not collapse paginated check-run objects into array pages', () => {
  const fake = fakeGitHub();
  const run: Runner = (args) => args[0]!.includes('/check-runs?') ? [
    { check_runs: [{ name: 'test', status: 'completed', conclusion: 'success', app: { id: 15368 } }] },
    { check_runs: [{ name: 'later', status: 'queued', conclusion: null, app: { id: 15368 } }] },
  ] : fake.run(args);
  expect(collectSnapshot(run, 'example/project', 7, policy()).checks.map((c) => c.state)).toEqual(['SUCCESS', 'PENDING']);
});
test('uses newest commit status and rejects malformed API data', () => {
  const fake = fakeGitHub();
  const run: Runner = (args) => args[0]!.includes('/statuses?') ? [[
    { context: 'legacy', state: 'failure' }, { context: 'legacy', state: 'success' },
  ]] : fake.run(args);
  expect(collectSnapshot(run, 'example/project', 7, policy()).checks.at(-1)!.state).toBe('FAILURE');
  expect(() => collectSnapshot(() => ({ errors: [{ message: 'denied' }] }), 'example/project', 7, policy())).toThrow();
});
test('a changed head during collection invalidates the snapshot', () => {
  const s = snapshot(), fake = fakeGitHub(s); let revisions = 0;
  const run: Runner = (args) => {
    if (args.some((a) => a.includes('nameWithOwner'))) { revisions++; if (revisions === 2) s.head = 'c'.repeat(40); }
    return fake.run(args);
  };
  expect(() => collectSnapshot(run, 'example/project', 7, policy())).toThrow('changed');
});
test('resolves abbreviated comment SHAs and rejects a different full commit', () => {
  const s = snapshot(), p = policy(); p.review.kind = 'codex'; s.reviews = [];
  const fake = fakeGitHub(s);
  const run: Runner = (args) => {
    if (args[0]!.includes('/comments?')) return [[{ user: { login: 'reviewer-example' },
      body: '**Reviewed commit:** `aaaaaaaaaa`', created_at: '2026-01-02T00:00:00Z' }]];
    if (args[0]!.endsWith('/commits/aaaaaaaaaa')) return { sha: 'aaaaaaaaaa' + 'c'.repeat(30) };
    return fake.run(args);
  };
  expect(collectSnapshot(run, 'example/project', 7, p).reviews).toEqual([]);
});
test('publication is explicitly scoped to this PR and head', () => {
  const fake = fakeGitHub(); publishStatus(fake.run, snapshot(), 'pending', 'Waiting');
  expect(fake.calls[0]).toContain(`repos/example/project/statuses/${HEAD}`);
  expect(fake.calls[0]).toContain('context=reviewlatch/pr-7');
});
test('a fork main branch does not make all target-main PRs dependents', () => {
  const s = snapshot(); s.headBranch = 'main'; s.dependents = [7, 8];
  const fake = fakeGitHub(s);
  const run: Runner = (args) => {
    const result = fake.run(args);
    if (args.some((a) => a.includes('nameWithOwner'))) {
      const data = object(object(result).data);
      object(object(data.repository).pullRequest).isCrossRepository = true;
    }
    return result;
  };
  expect(collectSnapshot(run, 'example/project', 7, policy()).dependents).toEqual([]);
  expect(fake.calls.some((a) => a[0]!.includes('/pulls?'))).toBe(false);
});
test('same-repository dependent detection excludes the PR itself', () => {
  const s = snapshot(); s.dependents = [7, 8];
  expect(collectSnapshot(fakeGitHub(s).run, 'example/project', 7, policy()).dependents).toEqual([8]);
});
