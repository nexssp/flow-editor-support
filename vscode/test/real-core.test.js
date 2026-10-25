'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CORE = process.env.FLOW_NFLOW_BIN || '';
const packageRoot = path.resolve(__dirname, '..');

test('VS Code package includes the native LSP launcher and a tested v0.44.1+ Flow core', { skip: !CORE }, () => {
  const result = spawnSync(CORE, ['--version'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const match = `${result.stdout}\n${result.stderr}`.match(/version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
  assert.ok(match, `could not read Flow version from: ${result.stdout}`);
  const actual = match.slice(1).map(Number);
  const minimum = [0, 44, 1];
  let compatible = true;
  for (let index = 0; index < minimum.length; index++) {
    if (actual[index] !== minimum[index]) { compatible = actual[index] > minimum[index]; break; }
  }
  assert.ok(compatible, `Flow v${actual.join('.')} is too old; v0.44.1 or newer is required`);
  assert.ok(fs.existsSync(path.join(packageRoot, 'lsp', 'nflow-lsp.js')));
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.ok(manifest.dependencies['vscode-languageclient']);
});
