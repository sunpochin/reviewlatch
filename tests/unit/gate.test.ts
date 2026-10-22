/* 檔案用途：驗證放行與失效邊界；所在層：單元測試；主要關聯：gate.ts。 */
import { describe, expect, test } from 'bun:test';
import { evaluate, reviewedCommit } from '../../src/gate.ts';
import { parsePolicy } from '../../src/policy.ts';
import { parseSnapshot } from '../../src/model.ts';
import { HEAD, policy, snapshot } from '../fixtures.ts';

describe('review evidence', () => {
  test('accepts a current approval and a successful check from its configured app', () => {
    expect(evaluate(snapshot(), policy())).toEqual({ ready: true, reasons: [], reviewers: ['reviewer-example'] });
  });
  test.each(['commit', 'author', 'retarget', 'dismissal', 'untrusted'])('rejects %s evidence', (kind) => {
    const s = snapshot();
    if (kind === 'commit') s.reviews[0]!.commit = 'c'.repeat(40);
    if (kind === 'author') s.author = 'reviewer-example';
    if (kind === 'retarget') s.lastBaseChange = '2026-01-03T00:00:00.000Z';
    if (kind === 'dismissal') s.reviews.push({ ...s.reviews[0]!, state: 'DISMISSED', at: '2026-01-03T00:00:00.000Z' });
    if (kind === 'untrusted') s.reviews[0]!.login = 'another-example';
    expect(evaluate(s, policy()).reasons).toContainEqual({ code: 'reviewMissing' });
  });
  test('does not invalidate approval for an ordinary later comment', () => {
    const s = snapshot(); s.reviews.push({ ...s.reviews[0]!, state: 'COMMENTED', at: '2026-01-03T00:00:00.000Z' });
    expect(evaluate(s, policy()).ready).toBe(true);
  });
  test('blocks an outstanding change request even from another reviewer', () => {
    const s = snapshot(); s.reviews.push({ ...s.reviews[0]!, login: 'another-example', state: 'CHANGES_REQUESTED' });
    expect(evaluate(s, policy()).reasons).toContainEqual({ code: 'changesRequested' });
  });
  test('Codex comments need a version statement tied to this head', () => {
    const s = snapshot(), p = policy(); p.review.kind = 'codex'; s.reviews[0]!.state = 'COMMENTED';
    expect(evaluate(s, p).ready).toBe(false);
    s.reviews[0]!.body = `**Reviewed commit:** \`${HEAD.slice(0, 10)}\``;
    expect(evaluate(s, p).ready).toBe(true);
    s.reviews[0]!.body = '**Reviewed commit:** `ccccccc`';
    expect(evaluate(s, p).ready).toBe(false);
  });
  test('does not confuse a reaction or malformed marker with a review', () => {
    expect(reviewedCommit('👍 looks good')).toBeNull();
    expect(reviewedCommit('**Reviewed commit:** `123`')).toBeNull();
  });
  test('counts distinct trusted reviewers', () => {
    const s = snapshot(), p = policy(); p.review.logins.push('second-example'); p.review.minimum = 2;
    s.reviews.push({ ...s.reviews[0]! });
    expect(evaluate(s, p).ready).toBe(false);
    s.reviews.push({ ...s.reviews[0]!, login: 'second-example' });
    expect(evaluate(s, p).ready).toBe(true);
  });
});
describe('merge conditions', () => {
  test.each(['PENDING', 'FAILURE', 'NEUTRAL', 'SKIPPED', 'UNKNOWN'])('rejects a %s check', (state) => {
    const s = snapshot(); s.checks[0]!.state = state; expect(evaluate(s, policy()).ready).toBe(false);
  });
  test('a same-name status cannot impersonate a pinned app', () => {
    const s = snapshot(); s.checks[0]!.appId = null;
    expect(evaluate(s, policy()).reasons).toContainEqual({ code: 'checkMissing', detail: 'test' });
  });
  test('conflicting duplicate checks do not pass', () => {
    const s = snapshot(); s.checks.push({ ...s.checks[0]!, state: 'FAILURE' }); expect(evaluate(s, policy()).ready).toBe(false);
  });
  test.each(['draft', 'closed', 'base', 'mergeable', 'mergeState', 'threads', 'dependents'])('blocks %s', (condition) => {
    const s = snapshot();
    if (condition === 'draft') s.draft = true;
    if (condition === 'closed') s.state = 'CLOSED';
    if (condition === 'base') s.baseBranch = 'unknown';
    if (condition === 'mergeable') s.mergeable = 'UNKNOWN';
    if (condition === 'mergeState') s.mergeState = 'BLOCKED';
    if (condition === 'threads') s.threads.push({ id: 'thread-example', path: 'src/example.ts', resolved: false });
    if (condition === 'dependents') s.dependents.push(8);
    expect(evaluate(s, policy()).reasons.some((r) => r.code === condition)).toBe(true);
  });
  test('release branches require an explicit flag', () => {
    const p = policy(); p.releaseBranches = ['main'];
    expect(evaluate(snapshot(), p).ready).toBe(false);
    expect(evaluate(snapshot(), p, { releaseAuthorized: true }).ready).toBe(true);
  });
  test('review publication does not wait for CI or for its own green status', () => {
    const s = snapshot(); s.checks = []; s.mergeState = 'BLOCKED';
    expect(evaluate(s, policy(), { purpose: 'review' }).ready).toBe(true);
    s.threads.push({ id: 'thread-example', path: 'test.ts', resolved: false });
    expect(evaluate(s, policy(), { purpose: 'review' }).ready).toBe(false);
  });
});
describe('input boundary', () => {
  test('rejects misspelled policy and implicit check provenance', () => {
    expect(() => parsePolicy({ ...policy(), requiredCheck: [] })).toThrow();
    expect(() => parsePolicy({ ...policy(), requiredChecks: [{ name: 'test' }] })).toThrow();
  });
  test('rejects empty safety requirements and duplicate reviewers', () => {
    expect(() => parsePolicy({ ...policy(), requiredChecks: [] })).toThrow();
    expect(() => parsePolicy({ ...policy(), review: { kind: 'approval', logins: ['Example', 'example'], minimum: 1 } })).toThrow();
  });
  test('does not treat missing evidence as an empty successful response', () => {
    expect(() => parseSnapshot({ ...snapshot(), threads: undefined })).toThrow();
    expect(() => parseSnapshot({ ...snapshot(), head: 'aaaaaaa' })).toThrow();
  });
});
