#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { nflowCommand } = require('./index.js');

const executable = nflowCommand();
const result = spawnSync(executable, ['fmt', ...process.argv.slice(2)], {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) {
  const hint = result.error.code === 'ENOENT'
    ? 'Install a Flow build that provides `nflow fmt`, or set NFLOW_BIN to its executable path.'
    : result.error.message;
  process.stderr.write(`flowfmt: cannot run nflow formatter "${executable}": ${hint}\n`);
  process.exitCode = 2;
} else {
  process.exitCode = result.status ?? 1;
}
