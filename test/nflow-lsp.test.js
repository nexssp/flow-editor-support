'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawnCaptured } = require('./helpers/process-tree');

const launcher = path.resolve(__dirname, '../lsp/nflow-lsp.js');

function makeFakeCore(version) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nflow fake core '));
  const executable = path.join(directory, 'fake nflow');
  fs.writeFileSync(executable, `#!/usr/bin/env node\n'use strict';\nconst args = process.argv.slice(2);\nif (args.length === 1 && args[0] === '--version') { process.stdout.write('nflow\\n  version: v${version}\\n'); process.exit(0); }\nif (args.length === 1 && args[0] === 'lsp') { process.stdin.pipe(process.stdout); process.stdin.on('end', () => process.exit(0)); } else { process.exit(17); }\n`);
  fs.chmodSync(executable, 0o755);
  return { executable, directory };
}

function runLauncher(executable, variable = 'NFLOW_BIN') {
  return spawnCaptured(process.execPath, [launcher], {
    env: {
      ...process.env,
      NFLOW_BIN: '',
      FLOW_NFLOW_LSP_BIN: '',
      FLOW_NFLOW_BIN: '',
      [variable]: executable,
    },
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

for (const variable of ['FLOW_NFLOW_LSP_BIN', 'FLOW_NFLOW_BIN']) {
  test(`native LSP launcher accepts legacy ${variable} as an executable fallback`, { timeout: 10000 }, async t => {
    const { executable, directory } = makeFakeCore('0.52.0');
    const managed = runLauncher(executable, variable);
    addCleanup(t, managed, directory);
    managed.child.stdin.end();
    const result = await managed.waitForClose(5000, `native LSP launcher via ${variable}`);
    assert.equal(result.code, 0, managed.diagnostics());
    assert.equal(Buffer.concat(managed.stderr).toString(), '');
  });
}

const shellLaunchers = [
  ['root', path.resolve(__dirname, '../lsp/nexss-flow-language-server')],
  ['Zed', path.resolve(__dirname, '../zed/lsp/nexss-flow-language-server')],
  ['legacy Zed', path.resolve(__dirname, '../zed-legacy-0.230.2/lsp/nexss-flow-language-server')],
];

function makeFakeNode(directory, label) {
  const executable = path.join(directory, `fake node ${label}`);
  fs.writeFileSync(executable, `#!/bin/sh\nprintf '${label}\\0' > "$NODE_OVERRIDE_RESULT"\nprintf '%s\\0' "$@" >> "$NODE_OVERRIDE_RESULT"\n`);
  fs.chmodSync(executable, 0o755);
  return executable;
}

test('shell LSP launchers prefer NEXSS_NFLOW_NODE and accept the legacy alias as fallback', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flow node override '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const resultPath = path.join(directory, 'observed args');
  const canonicalNode = makeFakeNode(directory, 'canonical');
  const legacyNode = makeFakeNode(directory, 'legacy');

  for (const [name, shellLauncher] of shellLaunchers) {
    for (const [canonical, expected] of [[canonicalNode, 'canonical'], ['', 'legacy']]) {
      const result = spawnSync('sh', [shellLauncher, '--probe', 'argument with spaces'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          NEXSS_NFLOW_NODE: canonical,
          NEXSS_FLOW_NODE: legacyNode,
          NODE_OVERRIDE_RESULT: resultPath,
        },
      });
      assert.equal(result.status, 0, `${name} launcher failed: ${result.stderr}`);
      const observed = fs.readFileSync(resultPath, 'utf8').split('\0').filter(Boolean);
      assert.deepEqual(observed, [
        expected,
        path.join(path.dirname(shellLauncher), 'nflow-lsp.js'),
        '--probe',
        'argument with spaces',
      ], `${name} launcher selected the wrong Node.js override or altered arguments`);
    }
  }
});
