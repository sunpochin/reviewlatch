#!/usr/bin/env bun
/*
檔案用途：可獨立安裝的命令列入口；所在層：CLI；主要關聯：policy、github、delivery、i18n。
*/
import { readFileSync } from 'node:fs';
import { evaluate } from './gate.ts';
import { collectSnapshot, OperationError, publishStatus, readRevision, runGh, type Runner } from './github.ts';
import { mergePullRequest } from './delivery.ts';
import { InputError, integer, parseSnapshot, repository, sha } from './model.ts';
import { parsePolicy } from './policy.ts';
import { detectLocale, text, type Locale } from './i18n.ts';

type Args = { command: string; number: number; config: string; repo: string; snapshot?: string;
  json: boolean; locale: Locale; execute: boolean; publish: boolean; release: boolean; expectedHead?: string };
export function parseArgs(argv: string[]): Args | null {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') return null;
  const result: Args = { command: argv[0]!, number: 0, config: '', repo: '', json: false,
    locale: detectLocale(), execute: false, publish: false, release: false };
  if (!['check', 'status', 'threads', 'merge', 'gate'].includes(result.command)) throw new InputError('command');
  const flags = new Set<string>();
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i]!;
    if (/^[1-9]\d*$/.test(key) && !result.number) { result.number = integer(Number(key), 'number'); continue; }
    if (flags.has(key)) throw new InputError('duplicate flag');
    flags.add(key);
    if (key === '--json') result.json = true;
    else if (key === '--execute') result.execute = true;
    else if (key === '--publish') result.publish = true;
    else if (key === '--release') result.release = true;
    else if (['--config', '--repo', '--snapshot', '--locale', '--expect-head'].includes(key)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new InputError(key);
      if (key === '--config') result.config = value;
      if (key === '--repo') result.repo = repository(value);
      if (key === '--snapshot') result.snapshot = value;
      if (key === '--expect-head') result.expectedHead = sha(value, 'expect-head');
      if (key === '--locale') {
        if (!['en', 'zh', 'id'].includes(value)) throw new InputError('locale');
        result.locale = value as Locale;
      }
    } else throw new InputError('argument');
  }
  if (!result.config) throw new InputError('config');
  if (result.command === 'check') {
    if (!result.snapshot || result.number || result.repo || result.publish || result.execute || result.expectedHead) throw new InputError('offline mode');
  } else if (result.snapshot || !result.number || !result.repo) throw new InputError('live mode');
  if (result.execute && result.command !== 'merge') throw new InputError('execute');
  if (result.expectedHead && result.command !== 'merge') throw new InputError('expect-head');
  if (result.publish && result.command !== 'gate') throw new InputError('publish');
  if (result.release && !['merge', 'check', 'status'].includes(result.command)) throw new InputError('release');
  return result;
}
function jsonFile(path: string): unknown {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { throw new InputError('JSON file'); }
}
function safeTerminal(value: string): string {
  // PR 路徑與遠端名稱是資料，不允許控制碼偽造終端機輸出。
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '?');
}
export function main(argv: string[], run: Runner = runGh, write: (line: string) => void = console.log): number {
  let locale = detectLocale();
  const explicitLocale = argv[argv.indexOf('--locale') + 1];
  if (argv.includes('--locale') && ['en', 'zh', 'id'].includes(explicitLocale ?? '')) locale = explicitLocale as Locale;
  try {
    const args = parseArgs(argv);
    if (!args) { write(text('help', locale)); return 0; }
    locale = args.locale;
    const policy = parsePolicy(jsonFile(args.config));
    if (args.command === 'merge') {
      const result = mergePullRequest(run, args.repo, args.number, policy, {
        execute: args.execute, expectedHead: args.expectedHead, releaseAuthorized: args.release,
      });
      if (args.json) write(JSON.stringify({ schemaVersion: 1, ...result }));
      else {
        write(text(result.merged ? 'merged' : result.decision.ready ? 'ready' : 'blocked', locale));
        for (const reason of result.decision.reasons) write(`${text(reason.code, locale)} ${safeTerminal(reason.detail ?? '')}`.trim());
        if (!args.execute) write(text('dryRun', locale));
      }
      return result.decision.ready ? 0 : 1;
    }
    let publishing: { repository: string; number: number; head: string } | undefined;
    if (args.publish) {
      const revision = readRevision(run, args.repo, args.number);
      publishing = { repository: args.repo, number: args.number, head: sha(revision.headRefOid, 'head') };
      // 先清掉舊綠燈，再讀完整資料；中途 API 出錯時保留 pending，不能沿用過期 success。
      publishStatus(run, publishing, 'pending', text('blocked', locale));
    }
    const snapshot = args.command === 'check' ? parseSnapshot(jsonFile(args.snapshot!)) : collectSnapshot(run, args.repo, args.number, policy);
    const decision = evaluate(snapshot, policy, { releaseAuthorized: args.release, purpose: args.command === 'gate' ? 'review' : 'merge' });
    if (publishing) {
      if (publishing.head !== snapshot.head) throw new OperationError('changed');
      publishStatus(run, snapshot, decision.ready ? 'success' : 'failure', `#${snapshot.number}@${snapshot.baseBranch} ${text(decision.ready ? 'ready' : 'blocked', locale)}`);
    }
    if (args.command === 'threads') {
      const unresolved = snapshot.threads.filter((t) => !t.resolved);
      write(args.json ? JSON.stringify({ schemaVersion: 1, threads: unresolved }) : unresolved.map((t) => `${safeTerminal(t.id)} ${safeTerminal(t.path)}`).join('\n'));
      return unresolved.length ? 1 : 0;
    }
    if (args.json) write(JSON.stringify({ schemaVersion: 1, purpose: args.command === 'gate' ? 'review' : 'merge', snapshot, decision }));
    else {
      write(`${snapshot.repository} #${snapshot.number} ${snapshot.head.slice(0, 10)}`);
      write(text(decision.ready ? 'ready' : 'blocked', locale));
      for (const reason of decision.reasons) write(`${text(reason.code, locale)} ${safeTerminal(reason.detail ?? '')}`.trim());
    }
    return decision.ready ? 0 : 1;
  } catch (error) {
    const code = error instanceof OperationError ? error.code : error instanceof InputError ? 'invalid' : 'error';
    const detail = error instanceof InputError ? safeTerminal(error.field) : undefined;
    write(argv.includes('--json') ? JSON.stringify({ schemaVersion: 1, error: code, ...(detail ? { field: detail } : {}) }) : `${text(code, locale)}${detail ? `: ${detail}` : ''}`);
    return 2;
  }
}
if (import.meta.main) process.exitCode = main(process.argv.slice(2));
