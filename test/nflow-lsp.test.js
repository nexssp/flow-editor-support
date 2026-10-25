'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnCaptured } = require('./helpers/process-tree');

const launcher = path.resolve(__dirname, '../lsp/nflow-lsp.js');

function makeFakeCore(version) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nflow fake core '));
  const executable = path.join(directory, 'fake nflow');
  fs.writeFileSync(executable, `#!/usr/bin/env node\n'use strict';\nconst args = process.argv.slice(2);\nif (args.length === 1 && args[0] === '--version') { process.stdout.write('nflow\\n  version: v${version}\\n'); process.exit(0); }\nif (args.length === 1 && args[0] === 'lsp') { process.stdin.pipe(process.stdout); process.stdin.on('end', () => process.exit(0)); } else { process.exit(17); }\n`);
  fs.chmodSync(executable, 0o755);
  return { executable, directory };
}

function runLauncher(executable) {
  return spawnCaptured(process.execPath, [launcher], {
    env: { ...process.env, NFLOW_BIN: executable },
  });
}

function addCleanup(t, managed, directory) {
  t.after(async () => {
    if (t.passed === false && managed.diagnostics()) t.diagnostic(managed.diagnostics());
    if (!await managed.stop()) t.diagnostic('Flow LSP launcher process tree did not close before the cleanup deadline.');
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('native LSP launcher verifies v0.44.2+ and passes stdio directly to `nflow lsp`', { timeout: 10000 }, async t => {
  const { executable, directory } = makeFakeCore('0.44.2');
  const managed = runLauncher(executable);
  const { child } = managed;
  addCleanup(t, managed, directory);
  const request = Buffer.from('Content-Length: 4\r\n\r\nping');
  child.stdin.write(request);
  child.stdin.end();
  const result = await managed.waitForClose(5000, 'native LSP launcher');
  assert.equal(result.code, 0, managed.diagnostics());
  assert.deepEqual(Buffer.concat(managed.stdout), request);
  assert.equal(Buffer.concat(managed.stderr).toString(), '');
});

test('native LSP launcher rejects an older core without starting its server', { timeout: 10000 }, async t => {
  const { executable, directory } = makeFakeCore('0.44.1');
  const managed = runLauncher(executable);
  const { child } = managed;
  addCleanup(t, managed, directory);
  child.stdin.end();
  const result = await managed.waitForClose(5000, 'native LSP launcher');
  assert.equal(result.code, 1);
  assert.equal(Buffer.concat(managed.stdout).toString(), '');
  assert.match(Buffer.concat(managed.stderr).toString(), /v0\.44\.2 or newer.*reported v0\.44\.1/);
});
