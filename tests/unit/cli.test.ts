/* 檔案用途：驗證 CLI 的離線、權限與語系邊界；所在層：命令列測試；主要關聯：cli.ts。 */
import { expect, test } from 'bun:test';
import { main, parseArgs } from '../../src/cli.ts';
import { fakeGitHub } from '../fixtures.ts';
const config = 'examples/reviewlatch.json';
test('offline demo runs without authentication or network', () => {
  const output: string[] = [];
  expect(main(['check', '--config', config, '--snapshot', 'examples/ready.json', '--json'], () => { throw new Error('network'); }, (s) => output.push(s))).toBe(0);
  expect(JSON.parse(output[0]!).decision.ready).toBe(true);
});
test.each(['en', 'zh', 'id'])('outputs an explicit blocked example in %s', (locale) => {
  const output: string[] = [];
  expect(main(['check', '--config', config, '--snapshot', 'examples/stale.json', '--locale', locale], undefined, (s) => output.push(s))).toBe(1);
  expect(output.join('\n')).not.toContain('undefined');
});
test('rejects mutation flags on read-only commands', () => {
  expect(() => parseArgs(['status', '7', '--repo', 'example/project', '--config', config, '--execute'])).toThrow();
  expect(() => parseArgs(['check', '--config', config, '--snapshot', 'examples/ready.json', '--publish'])).toThrow();
});
test('publishing invalidates an older green status before collecting evidence', () => {
  const fake = fakeGitHub(); const output: string[] = [];
  const run = (args: string[]) => {
    if (args[0]!.includes('/reviews?')) throw new Error('private error detail');
    return fake.run(args);
  };
  expect(main(['gate', '7', '--repo', 'example/project', '--config', config, '--publish', '--json'], run, (s) => output.push(s))).toBe(2);
  expect(fake.calls.filter((a) => a.includes('POST'))).toHaveLength(1);
  expect(fake.calls.find((a) => a.includes('POST'))).toContain('state=pending');
  expect(output.join('')).not.toContain('private error detail');
});
