/* 檔案用途：公開純函式 API；所在層：套件入口；主要關聯：model、policy、gate。 */
export { parseSnapshot, InputError } from './model.ts';
export type { Snapshot, Review, Check, Thread } from './model.ts';
export { parsePolicy } from './policy.ts';
export type { Policy } from './policy.ts';
export { evaluate, currentReviewers, reviewedCommit, sameRevision } from './gate.ts';
export type { Decision, Reason, ReasonCode } from './gate.ts';
