#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('node:child_process');

const MINIMUM_VERSION = [0, 44, 2];
const { nflowExecutable } = require('./nflow-command');
const executable = nflowExecutable();

function fail(message) {
  process.stderr.write(`[Nexss Flow LSP] ${message}\n`);
  process.exitCode = 1;
}

function versionAtLeast(version, minimum) {
  for (let index = 0; index < minimum.length; index++) {
    if (version[index] !== minimum[index]) return version[index] > minimum[index];
  }
  return true;
}

const checked = spawnSync(executable, ['--version'], {
  encoding: 'utf8',
  windowsHide: true,
});
if (checked.error || checked.status !== 0) {
  fail(`Could not run the selected Flow executable (${executable}): ${checked.error?.message || checked.stderr || `exit ${checked.status}`}`);
} else {
  const output = `${checked.stdout || ''}\n${checked.stderr || ''}`;
  const match = output.match(/version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) {
    fail(`Could not read a Flow version from '${executable} --version': ${output.trim() || '(no output)'}`);
  } else {
    const version = match.slice(1).map(Number);
    if (!versionAtLeast(version, MINIMUM_VERSION)) {
      fail(`Flow core v0.44.2 or newer is required for the native language server; '${executable} --version' reported v${version.join('.')}.`);
    } else {
      const server = spawn(executable, ['lsp'], {
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
      });
      server.on('error', error => fail(`Could not start '${executable} lsp': ${error.message}`));
      server.on('exit', (code, signal) => {
        process.exitCode = code ?? (signal ? 1 : 0);
      });
      for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => server.kill(signal));
      }
    }
  }
}
