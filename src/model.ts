/*
檔案用途：定義與驗證可重播的 PR 快照；所在層：純資料邊界。
主要關聯：github.ts 讀取、gate.ts 判斷、CLI 的離線範例。
*/
export type Review = {
  login: string; state: string; commit: string; body: string; at: string;
};
export type Check = { name: string; state: string; appId: number | null };
export type Thread = { id: string; resolved: boolean; path: string };
export type Snapshot = {
  schemaVersion: 1; repository: string; number: number; author: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED'; draft: boolean;
  head: string; headBranch: string; base: string; baseBranch: string;
  mergeable: string; mergeState: string; lastBaseChange: string | null;
  checks: Check[]; reviews: Review[]; threads: Thread[]; dependents: number[];
};

export class InputError extends Error {
  constructor(public field: string) { super(field); this.name = 'InputError'; }
}
export function object(value: unknown, field = 'object'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError(field);
  return value as Record<string, unknown>;
}
export function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.length) throw new InputError(field);
  return value;
}
export function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new InputError(field);
  return value;
}
export function integer(value: unknown, field: string, min = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) throw new InputError(field);
  return value as number;
}
export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new InputError(field);
  return value;
}
export function sha(value: unknown, field: string): string {
  const text = string(value, field);
  if (!/^[a-f0-9]{40}$/.test(text)) throw new InputError(field);
  return text;
}
export function repository(value: unknown): string {
  const name = string(value, 'repository');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) throw new InputError('repository');
  return name;
}
export function time(value: unknown, field: string): string {
  const text = string(value, field);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(text) || !Number.isFinite(Date.parse(text))) throw new InputError(field);
  return new Date(text).toISOString();
}
export function parseSnapshot(value: unknown): Snapshot {
  const v = object(value, 'snapshot');
  if (v.schemaVersion !== 1) throw new InputError('schemaVersion');
  const state = string(v.state, 'state');
  if (!['OPEN', 'CLOSED', 'MERGED'].includes(state)) throw new InputError('state');
  return {
    schemaVersion: 1, repository: repository(v.repository), number: integer(v.number, 'number'),
    author: string(v.author, 'author'), state: state as Snapshot['state'], draft: boolean(v.draft, 'draft'),
    head: sha(v.head, 'head'), base: sha(v.base, 'base'),
    headBranch: string(v.headBranch, 'headBranch'), baseBranch: string(v.baseBranch, 'baseBranch'),
    mergeable: string(v.mergeable, 'mergeable'), mergeState: string(v.mergeState, 'mergeState'),
    lastBaseChange: v.lastBaseChange === null ? null : time(v.lastBaseChange, 'lastBaseChange'),
    checks: array(v.checks, 'checks').map((item) => {
      const c = object(item, 'check');
      return { name: string(c.name, 'check.name'), state: string(c.state, 'check.state'), appId: c.appId === null ? null : integer(c.appId, 'check.appId') };
    }),
    reviews: array(v.reviews, 'reviews').map((item) => {
      const r = object(item, 'review');
      if (typeof r.body !== 'string') throw new InputError('review.body');
      return { login: string(r.login, 'review.login'), state: string(r.state, 'review.state'),
        commit: sha(r.commit, 'review.commit'), body: r.body, at: time(r.at, 'review.at') };
    }),
    threads: array(v.threads, 'threads').map((item) => {
      const t = object(item, 'thread');
      return { id: string(t.id, 'thread.id'), path: string(t.path, 'thread.path'), resolved: boolean(t.resolved, 'thread.resolved') };
    }),
    dependents: array(v.dependents, 'dependents').map((item) => integer(item, 'dependent')),
  };
}
