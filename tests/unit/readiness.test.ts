/* 檔案用途：鎖住可組合 API 的嚴格預設與明示相容政策；所在層：單元測試；主要關聯：readiness.ts、checks.ts。 */
import { expect, test } from 'bun:test';
import { checkOutcome, latestChecksByName, inspectPrState, inspectThreads, evaluate } from '../../src/index.ts';
import { policy, snapshot } from '../fixtures.ts';

test('strict state checks reject unknown states; review mode avoids its own CI dependency', () => {
  const facts = { ...snapshot(), mergeable: 'FUTURE', mergeState: 'FUTURE' };
  expect(inspectPrState(facts, { baseBranches: ['main'] })).toEqual([
    { code: 'mergeable', detail: 'FUTURE' }, { code: 'mergeState', detail: 'FUTURE' },
  ]);
  expect(inspectPrState(facts, { baseBranches: ['main'], purpose: 'review' })).toEqual([]);
  expect(evaluate(facts, policy()).ready).toBe(false);
});

test('compatibility policies are explicit and never change evaluate defaults', () => {
  const facts = { ...snapshot(), mergeState: 'UNSTABLE' };
  expect(inspectPrState(facts, { baseBranches: ['main'], mergeState: { deny: ['BLOCKED', 'BEHIND'] } })).toEqual([]);
  expect(evaluate(facts, policy()).reasons).toContainEqual({ code: 'mergeState', detail: 'UNSTABLE' });
  expect(inspectPrState({ ...facts, state: 'CLOSED', draft: true, baseBranch: 'other' }, { baseBranches: ['main'], purpose: 'review' }))
    .toEqual([{ code: 'closed' }, { code: 'draft' }, { code: 'base', detail: 'other' }]);
});

test('incomplete, negative and invalid thread counts never masquerade as zero', () => {
  expect(inspectThreads(0, true)).toEqual([]);
  expect(inspectThreads(2, false)).toEqual([{ code: 'threadsIncomplete' }, { code: 'threads', detail: '2' }]);
  for (const invalid of [-1, 0.5, NaN, Infinity]) expect(inspectThreads(invalid, true)).toEqual([{ code: 'threadsIncomplete' }]);
});

test('rollups distinguish statuses, incomplete runs, skipped and explicit neutral policy', () => {
  const run = { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'NEUTRAL' };
  expect(checkOutcome(run)).toBe('fail');
  expect(checkOutcome(run, { neutralIsSuccess: true })).toBe('pass');
  expect(checkOutcome({ ...run, conclusion: 'SKIPPED' })).toBe('skipped');
  expect(checkOutcome({ ...run, status: 'QUEUED', conclusion: 'SUCCESS' })).toBe('pending');
  expect(checkOutcome({ ...run, __typename: 'Unknown', conclusion: 'SUCCESS' })).toBe('fail');
  for (const state of ['PENDING', 'EXPECTED']) expect(checkOutcome({ __typename: 'StatusContext', state })).toBe('pending');
  for (const state of ['ERROR', 'FAILURE', 'UNKNOWN', 'NEUTRAL']) expect(checkOutcome({ __typename: 'StatusContext', state })).toBe('fail');
  expect(checkOutcome({ __typename: 'StatusContext', state: 'success' })).toBe('pass');
  for (const conclusion of ['CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'UNKNOWN']) expect(checkOutcome({ ...run, conclusion })).toBe('fail');
});

test('latest selection is deterministic, stable on ties and leaves input untouched', () => {
  const checks = [
    { name: 'z', startedAt: '2026-01-02', value: 'new' },
    { name: 'z', startedAt: '2026-01-01', value: 'old' },
    { name: 'a', startedAt: null, value: 'first' },
    { name: 'a', startedAt: null, value: 'last' },
  ];
  expect(latestChecksByName(checks)).toEqual([checks[3], checks[0]]);
  expect(checks.map((c) => c.value)).toEqual(['new', 'old', 'first', 'last']);
});
