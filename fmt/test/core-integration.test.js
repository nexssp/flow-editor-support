'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CORE = process.env.FLOW_NFLOW_BIN || '';
const source = [
  '@nflow_version ">=0.44.1"',
  '@description "Formatter integration"',
  '@pipeline editor:timeout=2s:retry=3',
  '  runtime.const:retry=1 @{ value: "ok" }',
  '@end',
  '@pipeline spaced :timeout=3s :retry=4',
  '  runtime.call :timeout=1s :retry=2',
  '@end',
  '@assert: result.ok == true',
  '',
].join('\n');
const adapters = [
  'fmt/index.js',
  'vscode/fmt/index.js',
  'zed/fmt/index.js',
  'zed-legacy-0.230.2/fmt/index.js',
  'claude/fmt/index.js',
  'notepadpp/fmt/index.js',
  'jetbrains/fmt/index.js',
];
const cliWrappers = [
  'fmt/cli.js',
  'claude/fmt/cli.js',
  'notepadpp/fmt/cli.js',
  'jetbrains/fmt/cli.js',
];

function runCore(args, input = '') {
  const result = spawnSync(CORE, ['fmt', ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('all editor formatter adapters match the actual Flow core formatter', { skip: !CORE }, () => {
  const expected = runCore(['--stdin'], source);
  for (const relativePath of adapters) {
    const { format } = require(path.join(ROOT, relativePath));
    assert.equal(format(source, { command: CORE }), expected, relativePath);
  }
});

test('all editor CLI wrappers pass stdin and atomic file writes to nflow fmt', { skip: !CORE }, t => {
  const expected = runCore(['--stdin'], source);
  const env = { ...process.env, NFLOW_BIN: CORE };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flow fmt real core '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [index, relativePath] of cliWrappers.entries()) {
    const script = path.join(ROOT, relativePath);
    const stdin = spawnSync(process.execPath, [script, '--stdin'], {
      input: source, encoding: 'utf8', env,
    });
    assert.equal(stdin.status, 0, `${relativePath}: ${stdin.stderr}`);
    assert.equal(stdin.stdout, expected, relativePath);

    const file = path.join(directory, `sample ${index}.nflow`);
    fs.writeFileSync(file, source);
    const write = spawnSync(process.execPath, [script, '--write', file], { encoding: 'utf8', env });
    assert.equal(write.status, 0, `${relativePath}: ${write.stderr}`);
    assert.equal(fs.readFileSync(file, 'utf8'), expected, relativePath);
    const check = spawnSync(process.execPath, [script, '--check', file], { encoding: 'utf8', env });
    assert.equal(check.status, 0, `${relativePath}: ${check.stderr}`);
  }
});

test('JetBrains External Tool command formats a named file with the real Flow core', { skip: !CORE }, t => {
  const expected = runCore(['--stdin'], source);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jetbrains flow formatter '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'sample file.nflow');
  fs.writeFileSync(file, source);
  const write = spawnSync(CORE, ['fmt', '--write', file], { encoding: 'utf8' });
  assert.equal(write.status, 0, write.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), expected);
});

test('nflow fmt --write leaves invalid source unchanged', { skip: !CORE }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nflow invalid source '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'invalid.nflow');
  const invalid = '@pipeline broken\n  (\n@end\n';
  fs.writeFileSync(file, invalid);
  const result = spawnSync(CORE, ['fmt', '--write', file], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected expression/);
  assert.equal(fs.readFileSync(file, 'utf8'), invalid);
});
