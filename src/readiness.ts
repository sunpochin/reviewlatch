/*
檔案用途：提供可組合的 PR 狀態與討論檢查；所在層：不做 I/O 的核心。
主要關聯：gate.ts、index.ts、tests/unit/readiness.test.ts；不代表完整合併授權。
*/
export type StateRule = { allow: readonly string[] } | { deny: readonly string[] };
export type PrState = { state: string; draft: boolean; baseBranch: string; mergeable: string; mergeState: string };
export type StatePolicy = {
  baseBranches: readonly string[];
  purpose?: 'merge' | 'review';
  mergeable?: StateRule;
  mergeState?: StateRule;
};
export type StateReason = { code: 'closed' | 'draft' | 'base' | 'mergeable' | 'mergeState'; detail?: string };

function rejected(value: string, rule: StateRule): boolean {
  return 'allow' in rule ? !rule.allow.includes(value) : rule.deny.includes(value);
}

// 預設拒絕未知狀態。deny 是既有系統遷移用的明示政策，不可誤當完整的安全閘門。
export function inspectPrState(pr: PrState, policy: StatePolicy): StateReason[] {
  const reasons: StateReason[] = [];
  if (pr.state !== 'OPEN') reasons.push({ code: 'closed' });
  if (pr.draft) reasons.push({ code: 'draft' });
  if (!policy.baseBranches.includes(pr.baseBranch)) reasons.push({ code: 'base', detail: pr.baseBranch });
  if (policy.purpose !== 'review') {
    if (rejected(pr.mergeable, policy.mergeable ?? { allow: ['MERGEABLE'] })) reasons.push({ code: 'mergeable', detail: pr.mergeable });
    if (rejected(pr.mergeState, policy.mergeState ?? { allow: ['CLEAN'] })) reasons.push({ code: 'mergeState', detail: pr.mergeState });
  }
  return reasons;
}

// 分頁不完整或計數無效都不能當作零條；呼叫端仍負責取得最新的完整證據。
export function inspectThreads(unresolved: number, complete: boolean): Array<{ code: 'threads' | 'threadsIncomplete'; detail?: string }> {
  const reasons: Array<{ code: 'threads' | 'threadsIncomplete'; detail?: string }> = [];
  if (!complete || !Number.isSafeInteger(unresolved) || unresolved < 0) reasons.push({ code: 'threadsIncomplete' });
  if (Number.isSafeInteger(unresolved) && unresolved > 0) reasons.push({ code: 'threads', detail: String(unresolved) });
  return reasons;
}
