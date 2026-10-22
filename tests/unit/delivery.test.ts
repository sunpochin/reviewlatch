/* 檔案用途：確認合併前重查、SHA 綁定與失敗停止；所在層：寫入測試；主要關聯：delivery.ts。 */
import { expect, test } from 'bun:test';
import { mergePullRequest } from '../../src/delivery.ts';
import type { Runner } from '../../src/github.ts';
import { HEAD, fakeGitHub, policy, snapshot } from '../fixtures.ts';
const options = { execute: true, expectedHead: HEAD, releaseAuthorized: false };
test('dry run cannot write', () => {
  let writes = 0;
  const result = mergePullRequest(() => { writes++; return {}; }, 'example/project', 7, policy(), { ...options, execute: false }, () => snapshot());
  expect(result.merged).toBe(false); expect(writes).toBe(0);
});
test('execution requires the caller to name the expected head before any API call', () => {
  expect(() => mergePullRequest(() => { throw new Error('called'); }, 'example/project', 7, policy(), { execute: true, releaseAuthorized: false })).toThrow('expectedHead');
});
test.each(['head', 'base', 'baseBranch'])('does not merge after %s changes', (field) => {
  let reads = 0, writes = 0;
  expect(() => mergePullRequest(() => { writes++; return {}; }, 'example/project', 7, policy(), options, () => {
    const s = snapshot(); reads++;
    if (reads === 2) { if (field === 'head') s.head = 'c'.repeat(40); if (field === 'base') s.base = 'd'.repeat(40); if (field === 'baseBranch') s.baseBranch = 'release'; }
    return s;
  })).toThrow('changed');
  expect(writes).toBe(0);
});
test('a new unresolved thread between reads blocks the write', () => {
  let reads = 0, writes = 0;
  const result = mergePullRequest(() => { writes++; return {}; }, 'example/project', 7, policy(), options, () => {
    const s = snapshot(); if (++reads === 2) s.threads.push({ id: 'new-thread', resolved: false, path: 'example.ts' }); return s;
  });
  expect(result.decision.ready).toBe(false); expect(writes).toBe(0);
});
test('sends one head-locked write and confirms the remote result', () => {
  const merged = snapshot(); merged.state = 'MERGED'; const fake = fakeGitHub(merged); const writes: string[][] = [];
  const run: Runner = (args) => {
    if (args.includes('PUT')) { writes.push(args); return { merged: true, sha: 'c'.repeat(40) }; }
    return fake.run(args);
  };
  const result = mergePullRequest(run, 'example/project', 7, policy(), options, () => snapshot());
  expect(result.merged).toBe(true); expect(writes).toHaveLength(1); expect(writes[0]).toContain(`sha=${HEAD}`);
});
test('an ambiguous write is never retried', () => {
  let writes = 0;
  expect(() => mergePullRequest(() => { writes++; throw new Error('timeout'); }, 'example/project', 7, policy(), options, () => snapshot())).toThrow('publicationUnknown');
  expect(writes).toBe(1);
});
