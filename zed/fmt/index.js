'use strict';

const { spawnSync } = require('node:child_process');

const DEFAULT_COMMAND = 'nflow';
const MAX_BUFFER = 32 * 1024 * 1024;

function nflowCommand(override, env = process.env) {
  if (typeof override === 'string' && override.trim()) return override.trim();
  if (typeof env.NFLOW_BIN === 'string' && env.NFLOW_BIN.trim()) {
    return env.NFLOW_BIN.trim();
  }
  return DEFAULT_COMMAND;
}

function runNflow(args, { command, input, env = process.env, cwd = process.cwd() } = {}) {
  const executable = nflowCommand(command, env);
  const result = spawnSync(executable, ['fmt', ...args], {
    cwd,
    env,
    input,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });

  if (result.error) {
    const hint = result.error.code === 'ENOENT'
      ? 'Install a Flow build that provides `nflow fmt`, or set NFLOW_BIN to its executable path.'
      : result.error.message;
    throw new Error(`cannot run nflow formatter "${executable}": ${hint}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim();
    throw new Error(`nflow fmt ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function format(source, options = {}) {
  const result = runNflow(['--stdin'], { ...options, input: String(source) });
  return result.stdout;
}

module.exports = { DEFAULT_COMMAND, format, nflowCommand, runNflow };
