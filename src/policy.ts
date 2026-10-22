/*
檔案用途：把專案政策與通用判斷分離；所在層：設定邊界。
主要關聯：gate.ts、reviewlatch.json、docs/configuration.md。
*/
import { array, InputError, integer, object, string } from './model.ts';

export type Policy = {
  schemaVersion: 1;
  baseBranches: string[];
  releaseBranches: string[];
  requiredChecks: { name: string; appId: number | null }[];
  review: { kind: 'approval' | 'codex'; logins: string[]; minimum: number };
  mergeMethod: 'merge' | 'squash' | 'rebase';
};
function strings(value: unknown, field: string): string[] {
  const result = array(value, field).map((v) => string(v, field));
  if (new Set(result).size !== result.length) throw new InputError(field);
  return result;
}
function keys(value: Record<string, unknown>, allowed: string[], field: string): void {
  // 設定打錯字應停止，不能把拼錯的安全條件默默忽略。
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new InputError(field);
}
export function parsePolicy(value: unknown): Policy {
  const v = object(value, 'policy');
  keys(v, ['schemaVersion', 'baseBranches', 'releaseBranches', 'requiredChecks', 'review', 'mergeMethod'], 'policy.keys');
  if (v.schemaVersion !== 1) throw new InputError('policy.schemaVersion');
  const baseBranches = strings(v.baseBranches, 'baseBranches');
  const releaseBranches = strings(v.releaseBranches, 'releaseBranches');
  if (!baseBranches.length || releaseBranches.some((b) => !baseBranches.includes(b))) throw new InputError('baseBranches');
  const requiredChecks = array(v.requiredChecks, 'requiredChecks').map((item) => {
    const c = object(item, 'requiredCheck');
    keys(c, ['name', 'appId'], 'requiredCheck.keys');
    const name = string(c.name, 'requiredCheck.name');
    if (name.startsWith('reviewlatch/')) throw new InputError('requiredCheck.recursion');
    return { name, appId: c.appId === null ? null : integer(c.appId, 'requiredCheck.appId') };
  });
  if (!requiredChecks.length) throw new InputError('requiredChecks');
  const r = object(v.review, 'review');
  keys(r, ['kind', 'logins', 'minimum'], 'review.keys');
  if (r.kind !== 'approval' && r.kind !== 'codex') throw new InputError('review.kind');
  const logins = strings(r.logins, 'review.logins').map((login) => login.toLowerCase());
  if (logins.some((login) => !/^[a-z0-9][a-z0-9-]*(?:\[bot\])?$/.test(login)) || new Set(logins).size !== logins.length) throw new InputError('review.logins');
  const minimum = integer(r.minimum, 'review.minimum');
  if (minimum > logins.length) throw new InputError('review.minimum');
  if (!['merge', 'squash', 'rebase'].includes(String(v.mergeMethod))) throw new InputError('mergeMethod');
  return { schemaVersion: 1, baseBranches, releaseBranches, requiredChecks,
    review: { kind: r.kind, logins, minimum }, mergeMethod: v.mergeMethod as Policy['mergeMethod'] };
}
