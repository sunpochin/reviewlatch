/*
檔案用途：將合併綁到使用者指定版本並重查所有條件；所在層：寫入邊界。
主要關聯：github.ts、gate.ts、CLI；不排自動合併、不重試不明結果。
*/
import { evaluate, sameRevision, type Decision } from './gate.ts';
import { collectSnapshot, OperationError, readRevision, type Runner } from './github.ts';
import { object, repository, sha, type Snapshot } from './model.ts';
import type { Policy } from './policy.ts';

export type MergeResult = { snapshot: Snapshot; decision: Decision; merged: boolean; mergeCommit?: string };
export function mergePullRequest(run: Runner, repo: string, number: number, policy: Policy,
  options: { execute: boolean; expectedHead?: string; releaseAuthorized: boolean },
  collect: typeof collectSnapshot = collectSnapshot): MergeResult {
  if (options.execute && !options.expectedHead) throw new OperationError('expectedHead');
  if (options.expectedHead) sha(options.expectedHead, 'expectedHead');
  const initial = collect(run, repo, number, policy);
  if (options.expectedHead && options.expectedHead !== initial.head) throw new OperationError('changed');
  const decision = evaluate(initial, policy, options);
  if (!decision.ready || !options.execute) return { snapshot: initial, decision, merged: false };
  // 查詢期間可能有人改 code、改 base、開 thread 或撤 approval，所以不可重用第一份綠燈。
  const fresh = collect(run, repo, number, policy);
  if (!sameRevision(initial, fresh)) throw new OperationError('changed');
  const latest = evaluate(fresh, policy, options);
  if (!latest.ready) return { snapshot: fresh, decision: latest, merged: false };
  let result: Record<string, unknown>;
  try {
    result = object(run([`repos/${repository(repo)}/pulls/${number}/merge`, '--method', 'PUT',
      '-f', `sha=${fresh.head}`, '-f', `merge_method=${policy.mergeMethod}`]), 'merge');
  } catch {
    // 網路斷線時服務端可能已成功，不自動再送一次。
    throw new OperationError('publicationUnknown');
  }
  if (result.merged !== true) throw new OperationError('publicationUnknown');
  try {
    const confirmed = readRevision(run, repo, number);
    if (confirmed.state !== 'MERGED' || confirmed.headRefOid !== fresh.head || confirmed.baseRefName !== fresh.baseBranch) throw new OperationError('publicationUnknown');
    return { snapshot: fresh, decision: latest, merged: true, mergeCommit: sha(result.sha, 'merge.sha') };
  } catch { throw new OperationError('publicationUnknown'); }
}
