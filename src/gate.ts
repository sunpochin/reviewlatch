/*
檔案用途：依審查版本、討論與 CI 決定是否放行；所在層：不做 I/O 的核心。
主要關聯：model.ts、policy.ts、tests/unit/gate.test.ts；來源脈絡見 NOTICE.md。
*/
import type { Review, Snapshot } from './model.ts';
import type { Policy } from './policy.ts';
import { inspectPrState, inspectThreads } from './readiness.ts';

export type ReasonCode = 'closed' | 'draft' | 'base' | 'release' | 'mergeable' | 'mergeState' |
  'checkMissing' | 'checkFailed' | 'reviewMissing' | 'changesRequested' | 'threads' | 'threadsIncomplete' | 'dependents';
export type Reason = { code: ReasonCode; detail?: string };
export type Decision = { ready: boolean; reasons: Reason[]; reviewers: string[] };

// 從原閘門抽出：只認明確的 commit 證據，不把表情、空白追問或一般留言當成完整審查。
export function reviewedCommit(body: string): string | null {
  return /\*\*Reviewed commit:\*\*\s*`([0-9a-f]{7,40})`/i.exec(body)?.[1]?.toLowerCase() ?? null;
}
export function currentReviewers(snapshot: Snapshot, policy: Policy): string[] {
  const trusted = new Set(policy.review.logins);
  const latest = new Map<string, Review>();
  for (const r of [...snapshot.reviews].sort((a, b) => a.at.localeCompare(b.at))) {
    const login = r.login.toLowerCase();
    if (!trusted.has(login) || login === snapshot.author.toLowerCase()) continue;
    // 一般 COMMENTED 不撤銷人工 approval；Codex 必須有完整的版本聲明才算一輪。
    if (r.state === 'COMMENTED' && (policy.review.kind !== 'codex' || !reviewedCommit(r.body))) continue;
    latest.set(login, r);
  }
  return [...latest.entries()].filter(([, r]) => {
    if (r.commit !== snapshot.head || (snapshot.lastBaseChange && r.at <= snapshot.lastBaseChange)) return false;
    if (policy.review.kind === 'approval') return r.state === 'APPROVED';
    const stated = reviewedCommit(r.body);
    return ['APPROVED', 'COMMENTED'].includes(r.state) && Boolean(stated && snapshot.head.startsWith(stated));
  }).map(([login]) => login).sort();
}
export function evaluate(snapshot: Snapshot, policy: Policy, options: { releaseAuthorized?: boolean; purpose?: 'merge' | 'review' } = {}): Decision {
  const reasons: Reason[] = [];
  const add = (code: ReasonCode, detail?: string) => reasons.push(detail ? { code, detail } : { code });
  const merging = options.purpose !== 'review';
  const stateReasons = inspectPrState(snapshot, { baseBranches: policy.baseBranches, purpose: options.purpose });
  reasons.push(...stateReasons.filter((r) => r.code !== 'mergeable' && r.code !== 'mergeState'));
  if (merging && policy.releaseBranches.includes(snapshot.baseBranch) && !options.releaseAuthorized) add('release', snapshot.baseBranch);
  // review status 若等待自己的 required check 變綠會形成死結；合併命令才檢查完整 CI／GitHub 狀態。
  reasons.push(...stateReasons.filter((r) => r.code === 'mergeable' || r.code === 'mergeState'));
  for (const required of merging ? policy.requiredChecks : []) {
    const found = snapshot.checks.filter((c) => c.name === required.name && (required.appId === null || required.appId === c.appId));
    if (!found.length) add('checkMissing', required.name);
    // skipped／neutral／未知都不代表必要測試成功；同名結果不一致也不猜。
    else if (found.some((c) => c.state !== 'SUCCESS')) add('checkFailed', required.name);
  }
  const latest = new Map<string, Review>();
  for (const r of [...snapshot.reviews].sort((a, b) => a.at.localeCompare(b.at))) {
    if (r.state !== 'COMMENTED') latest.set(r.login.toLowerCase(), r);
  }
  if ([...latest.values()].some((r) => r.state === 'CHANGES_REQUESTED')) add('changesRequested');
  const reviewers = currentReviewers(snapshot, policy);
  if (reviewers.length < policy.review.minimum) add('reviewMissing');
  const unresolved = snapshot.threads.filter((t) => !t.resolved);
  reasons.push(...inspectThreads(unresolved.length, true));
  // 第一版不自動改別張 PR 的 base，避免合併刪分支時關閉下游 PR。
  if (merging && snapshot.dependents.length) add('dependents', snapshot.dependents.join(', '));
  return { ready: reasons.length === 0, reasons, reviewers };
}

export function sameRevision(a: Snapshot, b: Snapshot): boolean {
  return a.repository.toLowerCase() === b.repository.toLowerCase() && a.number === b.number &&
    a.head === b.head && a.base === b.base && a.baseBranch === b.baseBranch && a.headBranch === b.headBranch;
}
