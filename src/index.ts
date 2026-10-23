/* 檔案用途：公開純函式 API；所在層：套件入口；主要關聯：model、policy、gate。 */
export { parseSnapshot, InputError } from './model.ts';
export type { Snapshot, Review, Check, Thread } from './model.ts';
export { parsePolicy } from './policy.ts';
export type { Policy } from './policy.ts';
export { evaluate, currentReviewers, reviewedCommit, sameRevision } from './gate.ts';
export type { Decision, Reason, ReasonCode } from './gate.ts';
export { inspectPrState, inspectThreads } from './readiness.ts';
export type { PrState, StatePolicy, StateReason, StateRule } from './readiness.ts';
export { checkOutcome, latestChecksByName } from './checks.ts';
export type { CheckOutcome, CheckRollup } from './checks.ts';
