/*
檔案用途：提供可組合的 PR 狀態與討論檢查；所在層：不做 I/O 的核心。
主要關聯：gate.ts、index.ts、tests/unit/readiness.test.ts；不代表完整合併授權。
*/
export type StateRule = { allow: readonly string[]; deny?: never } | { deny: readonly string[]; allow?: never };
export type PrState = { state: string; draft: boolean; baseBranch: string; mergeable: string; mergeState: string };
export type StatePolicy = {
  baseBranches: readonly string[];
  purpose?: 'merge' | 'review';
  mergeable?: StateRule;
  mergeState?: StateRule;
};
export type StateReason = { code: 'closed' | 'draft' | 'base' | 'mergeable' | 'mergeState'; detail?: string };

function rejected(value: string, rule: StateRule): boolean {
  // deny 只列出已知禁用狀態；缺少狀態不是新的合法值，必須先擋下不完整證據。
  if (typeof value !== 'string' || !value.trim()) return true;
  // 不可讓互相矛盾的規則因欄位優先順序而放行；未經 TS 檢查的設定也要拒絕。
  if (!rule || typeof rule !== 'object') return true;
  const allow = 'allow' in rule;
  if (allow === ('deny' in rule)) return true;
  const values = allow ? rule.allow : rule.deny;
  if (!Array.isArray(values) || !values.every((entry) => typeof entry === 'string')) return true;
  return allow ? !values.includes(value) : values.includes(value);
}

// 預設拒絕未知狀態。deny 是既有系統遷移用的明示政策，不可誤當完整的安全閘門。
export function inspectPrState(pr: PrState, policy: StatePolicy): StateReason[] {
  const reasons: StateReason[] = [];
  if (pr.state !== 'OPEN') reasons.push({ code: 'closed' });
  if (pr.draft !== false) reasons.push({ code: 'draft' });
  if (!policy.baseBranches.includes(pr.baseBranch)) reasons.push({ code: 'base', detail: pr.baseBranch });
  if (policy.purpose !== 'review') {
    // 只為省略的政策補預設；JSON 明示的 null 是無效規則，不能當作未設定。
    if (rejected(pr.mergeable, policy.mergeable === undefined ? { allow: ['MERGEABLE'] } : policy.mergeable)) reasons.push({ code: 'mergeable', detail: pr.mergeable });
    if (rejected(pr.mergeState, policy.mergeState === undefined ? { allow: ['CLEAN'] } : policy.mergeState)) reasons.push({ code: 'mergeState', detail: pr.mergeState });
  }
  return reasons;
}

// 分頁不完整或計數無效都不能當作零條；呼叫端仍負責取得最新的完整證據。
export function inspectThreads(unresolved: number, complete: boolean): Array<{ code: 'threads' | 'threadsIncomplete'; detail?: string }> {
  const reasons: Array<{ code: 'threads' | 'threadsIncomplete'; detail?: string }> = [];
  if (complete !== true || !Number.isSafeInteger(unresolved) || unresolved < 0) reasons.push({ code: 'threadsIncomplete' });
  if (Number.isSafeInteger(unresolved) && unresolved > 0) reasons.push({ code: 'threads', detail: String(unresolved) });
  return reasons;
}
