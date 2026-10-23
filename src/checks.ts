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
  // JSON 呼叫端的 "false" 也是 truthy，只有真正的布林 true 才算明確放寬政策。
  if (conclusion === 'SUCCESS' || (conclusion === 'NEUTRAL' && options.neutralIsSuccess === true)) return 'pass';
  if (conclusion === 'SKIPPED') return 'skipped';
  return 'fail';
}

// 同時刻維持輸入最後一筆；同名有缺時間的結果就無法排序，不能猜測它是較舊的一筆。
// 嚴格 evaluator 仍檢查所有同名必要結果，不能偷偷換成只看最新而放行衝突證據。
export function latestChecksByName<T extends { name: string; startedAt: string | null }>(checks: readonly T[]): T[] {
  const latest = new Map<string, { check: T; time: number | null }>();
  for (const check of checks) {
    // 時區與小數精度會讓字串排序顛倒；無效時間必須中止，避免丟掉可能失敗的證據。
    const time = check.startedAt === null ? null : Date.parse(check.startedAt);
    if (check.startedAt !== null && !Number.isFinite(time)) throw new RangeError('invalid-check-timestamp');
    // Date.parse 會截掉毫秒以後的小數；無法精確表示就拒絕，不能把新失敗當成與舊成功同時。
    // 超過三位但全為補零仍是可精確表示的時間，因此不必拒絕等價的 ISO 表示法。
    if (check.startedAt !== null && /\.\d{3}\d*[1-9]/.test(check.startedAt)) throw new RangeError('unsupported-check-timestamp-precision');
    const previous = latest.get(check.name);
    if (!previous) {
      latest.set(check.name, { check, time });
      continue;
    }
    // queued 重跑可以尚無 startedAt；直接丟掉它會讓舊成功遮住仍在等待的 CI。
    if (time === null || previous.time === null) throw new RangeError('ambiguous-check-timestamps');
    if (time >= previous.time) latest.set(check.name, { check, time });
  }
  return [...latest.values()].map(({ check }) => check).sort((a, b) => a.name.localeCompare(b.name));
}
