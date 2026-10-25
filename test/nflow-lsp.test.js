'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const launcher = path.resolve(__dirname, '../lsp/nflow-lsp.js');

function makeFakeCore(t, version) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nflow fake core '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'fake nflow');
  fs.writeFileSync(executable, `#!/usr/bin/env node\n'use strict';\nconst args = process.argv.slice(2);\nif (args.length === 1 && args[0] === '--version') { process.stdout.write('nflow\\n  version: v${version}\\n'); process.exit(0); }\nif (args.length === 1 && args[0] === 'lsp') { process.stdin.pipe(process.stdout); process.stdin.on('end', () => process.exit(0)); } else { process.exit(17); }\n`);
  fs.chmodSync(executable, 0o755);
  return executable;
}

function runLauncher(executable) {
  const child = spawn(process.execPath, [launcher], {
    env: { ...process.env, NFLOW_BIN: executable },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  const exit = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  return { child, stdout, stderr, exit };
}

test('native LSP launcher verifies v0.44.1+ and passes stdio directly to `nflow lsp`', async t => {
  const executable = makeFakeCore(t, '0.44.1');
  const { child, stdout, stderr, exit } = runLauncher(executable);
  const request = Buffer.from('Content-Length: 4\r\n\r\nping');
  child.stdin.write(request);
  child.stdin.end();
  const result = await exit;
  assert.equal(result.code, 0, Buffer.concat(stderr).toString());
  assert.deepEqual(Buffer.concat(stdout), request);
  assert.equal(Buffer.concat(stderr).toString(), '');
});

test('native LSP launcher rejects an older core without starting its server', async t => {
  const executable = makeFakeCore(t, '0.44.0');
  const { child, stdout, stderr, exit } = runLauncher(executable);
  child.stdin.end();
  const result = await exit;
  assert.equal(result.code, 1);
  assert.equal(Buffer.concat(stdout).toString(), '');
  assert.match(Buffer.concat(stderr).toString(), /v0\.44\.1 or newer.*reported v0\.44\.0/);
});
