/* 檔案用途：鎖住可組合 API 的嚴格預設與明示相容政策；所在層：單元測試；主要關聯：readiness.ts、checks.ts。 */
import { expect, test } from 'bun:test';
import { checkOutcome, latestChecksByName, inspectPrState, inspectThreads, evaluate, type StateRule } from '../../src/index.ts';
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

test('only literal true establishes thread completeness or neutral success', () => {
  const run = { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'NEUTRAL' };
  // 模擬 JavaScript／JSON 呼叫端，不能因字串或數字為 truthy 就取得放行權。
  for (const invalid of [...JSON.parse('[false,"false","true",1,0,null,{},[]]'), undefined]) {
    expect(inspectThreads(0, invalid)).toEqual([{ code: 'threadsIncomplete' }]);
    expect(checkOutcome(run, { neutralIsSuccess: invalid })).toBe('fail');
  }
});

test('ambiguous and malformed state rules block instead of ignoring a restriction', () => {
  // 型別檢查也必須拒絕同時指定；執行期仍需防範未經型別檢查的 JSON。
  // @ts-expect-error allow and deny are mutually exclusive
  const ambiguous: StateRule = { allow: ['MERGEABLE', 'CLEAN'], deny: ['MERGEABLE', 'CLEAN'] };
  const invalidRules = [ambiguous, ...JSON.parse('[null, {}, {"allow":"MERGEABLE CLEAN"}, {"deny":[] ,"allow":null}, {"deny":[null]}]')];
  for (const rule of invalidRules) {
    expect(inspectPrState(snapshot(), { baseBranches: ['main'], mergeable: rule, mergeState: rule })).toEqual([
      { code: 'mergeable', detail: 'MERGEABLE' }, { code: 'mergeState', detail: 'CLEAN' },
    ]);
  }
});

test('compatibility deny rules cannot accept missing or malformed state evidence', () => {
  const compatibility = { baseBranches: ['main'], mergeable: { deny: ['CONFLICTING'] }, mergeState: { deny: ['BLOCKED'] } };
  for (const missing of [...JSON.parse('[null, "", " ", 0, false, {}, []]'), undefined]) {
    expect(inspectPrState({ ...snapshot(), mergeable: missing, mergeState: missing }, compatibility).map(reason => reason.code))
      .toEqual(['mergeable', 'mergeState']);
    if (missing !== false) expect(inspectPrState({ ...snapshot(), draft: missing }, compatibility).map(reason => reason.code)).toEqual(['draft']);
  }
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
    { name: 'a', startedAt: '2026-01-02', value: 'first' },
    { name: 'a', startedAt: '2026-01-02', value: 'last' },
  ];
  expect(latestChecksByName(checks)).toEqual([checks[3], checks[0]]);
  expect(checks.map((c) => c.value)).toEqual(['new', 'old', 'first', 'last']);
});

test('latest selection compares instants across offsets and fractional precision', () => {
  const checks = [
    { name: 'offset', startedAt: '2026-01-01T01:00:00+01:00', outcome: 'pass' },
    { name: 'offset', startedAt: '2026-01-01T00:30:00Z', outcome: 'fail' },
    { name: 'fraction', startedAt: '2026-01-01T00:00:00Z', outcome: 'pass' },
    { name: 'fraction', startedAt: '2026-01-01T00:00:00.100Z', outcome: 'fail' },
    { name: 'tie', startedAt: '2026-01-01T01:00:00+01:00', outcome: 'pass' },
    { name: 'tie', startedAt: '2026-01-01T00:00:00.000Z', outcome: 'fail' },
    { name: 'missing', startedAt: null, outcome: 'pending' },
  ];
  expect(latestChecksByName(checks)).toEqual([checks[3], checks[6], checks[1], checks[5]]);
});

test('duplicate runs with missing times are incomplete evidence in either order', () => {
  const success = { name: 'test', startedAt: '2026-01-01T00:00:00Z', status: 'COMPLETED', conclusion: 'SUCCESS' };
  const queued = { name: 'test', startedAt: null, status: 'QUEUED', conclusion: null };
  // 尚未開始的重跑沒有時間；無法判定先後時，不能猜測它早於已完成的成功結果。
  for (const checks of [[success, queued], [queued, success], [queued, queued]]) {
    expect(() => latestChecksByName(checks)).toThrow('ambiguous-check-timestamps');
  }
  expect(latestChecksByName([queued]).map(check => checkOutcome({ __typename: 'CheckRun', ...check }))).toEqual(['pending']);
});

test('unparseable timestamps cannot silently discard failure evidence', () => {
  const success = { name: 'test', startedAt: '2026-01-01T00:00:00Z', outcome: 'pass' };
  for (const startedAt of ['', 'not-a-date']) {
    const failure = { name: 'test', startedAt, outcome: 'fail' };
    for (const checks of [[failure], [success, failure], [failure, success]]) {
      expect(() => latestChecksByName(checks)).toThrow('invalid-check-timestamp');
    }
  }
});

test('sub-millisecond instants cannot collapse into an input-order tie', () => {
  const failure = { name: 'test', startedAt: '2026-01-01T00:00:00.0009Z', outcome: 'fail' };
  const success = { name: 'test', startedAt: '2026-01-01T00:00:00.0001Z', outcome: 'pass' };
  // Date.parse 只保留毫秒；明確拒絕超出可表示精度的證據，不能假裝兩者同時。
  for (const checks of [[failure, success], [success, failure], [failure]]) {
    expect(() => latestChecksByName(checks)).toThrow('unsupported-check-timestamp-precision');
  }
  const exact = { ...success, startedAt: '2026-01-01T00:00:00.123000Z' };
  const equivalent = { ...failure, startedAt: '2026-01-01T01:00:00.123+01:00' };
  expect(latestChecksByName([exact, equivalent])).toEqual([equivalent]);
});
