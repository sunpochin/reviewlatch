/*
檔案用途：分類 GitHub rollup 並保留同名檢查的最新結果；所在層：純函式。
主要關聯：index.ts、tests/unit/readiness.test.ts；來源與必要檢查政策仍由呼叫端驗證。
*/
export type CheckOutcome = 'pass' | 'fail' | 'pending' | 'skipped';
export type CheckRollup = {
  __typename: string; name?: string | null; context?: string | null;
  status?: string | null; conclusion?: string | null; state?: string | null;
  startedAt?: string | null; detailsUrl?: string | null; targetUrl?: string | null;
};

export function checkOutcome(item: CheckRollup, options: { neutralIsSuccess?: boolean } = {}): CheckOutcome {
  if (item.__typename === 'StatusContext') {
    const state = (item.state ?? '').toUpperCase();
    if (state === 'SUCCESS') return 'pass';
    if (state === 'PENDING' || state === 'EXPECTED') return 'pending';
    return 'fail';
  }
  if (item.__typename !== 'CheckRun') return 'fail';
  if ((item.status ?? '').toUpperCase() !== 'COMPLETED') return 'pending';
  const conclusion = (item.conclusion ?? '').toUpperCase();
  if (conclusion === 'SUCCESS' || (conclusion === 'NEUTRAL' && options.neutralIsSuccess)) return 'pass';
  if (conclusion === 'SKIPPED') return 'skipped';
  return 'fail';
}

// 同時刻維持輸入最後一筆，缺時間視為最早；只供明確採「最新 run」政策的 adapter 使用。
// 嚴格 evaluator 仍檢查所有同名必要結果，不能偷偷換成只看最新而放行衝突證據。
export function latestChecksByName<T extends { name: string; startedAt: string | null }>(checks: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const check of checks) {
    const previous = latest.get(check.name);
    if (!previous || (check.startedAt ?? '') >= (previous.startedAt ?? '')) latest.set(check.name, check);
  }
  return [...latest.values()].sort((a, b) => a.name.localeCompare(b.name));
}
