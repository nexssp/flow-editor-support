'use strict';

const { spawn, spawnSync } = require('node:child_process');

const CAPTURE_LIMIT = 128 * 1024;
const DEFAULT_GRACE_MS = 500;
const DEFAULT_FORCE_MS = 1000;

function appendCapture(chunks, chunk) {
  chunks.push(Buffer.from(chunk));
  let combined = Buffer.concat(chunks);
  if (combined.length > CAPTURE_LIMIT) combined = combined.subarray(combined.length - CAPTURE_LIMIT);
  chunks.splice(0, chunks.length, combined);
}

function timeoutError(label, timeoutMs, managed) {
  const output = managed.diagnostics();
  return new Error(`${label} did not close within ${timeoutMs} ms${output ? `\n${output}` : ''}`);
}

function spawnCaptured(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: process.platform === 'win32' ? options.detached : true,
    stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
  });
  const stdout = [];
  const stderr = [];
  child.stdout?.on('data', chunk => appendCapture(stdout, chunk));
  child.stderr?.on('data', chunk => appendCapture(stderr, chunk));

  let closeResult;
  const closed = new Promise(resolve => {
    child.once('close', (code, signal) => {
      closeResult = { code, signal };
      resolve(closeResult);
    });
  });

  const managed = {
    child,
    stdout,
    stderr,
    closed,
    get closeResult() { return closeResult; },
    diagnostics() {
      const out = Buffer.concat(stdout).toString('utf8').trim();
      const err = Buffer.concat(stderr).toString('utf8').trim();
      return [out && `stdout:\n${out}`, err && `stderr:\n${err}`].filter(Boolean).join('\n');
    },
    async waitForClose(timeoutMs = 10000, label = 'child process') {
      let timer;
      try {
        return await Promise.race([
          closed,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(timeoutError(label, timeoutMs, managed)), timeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    stop(optionsForStop = {}) {
      if (!managed.stopPromise) managed.stopPromise = terminateProcessTree(managed, optionsForStop);
      return managed.stopPromise;
    },
  };
  return managed;
}

function signalProcessTree(managed, signal) {
  const { child } = managed;
  if (!child.pid) {
    try { child.kill(signal); } catch {}
    return;
  }

  if (process.platform === 'win32') {
    if (signal === 'SIGKILL') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        encoding: 'utf8',
        timeout: 1500,
        windowsHide: true,
        stdio: 'ignore',
      });
    } else {
      try { child.kill(signal); } catch {}
    }
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function closedWithin(managed, timeoutMs) {
  if (managed.closeResult) return true;
  let timer;
  try {
    return await Promise.race([
      managed.closed.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function terminateProcessTree(managed, options = {}) {
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
  const forceMs = options.forceMs ?? DEFAULT_FORCE_MS;
  const { child } = managed;

  if (!managed.closeResult) {
    signalProcessTree(managed, 'SIGTERM');
    if (process.platform !== 'win32' && !await closedWithin(managed, graceMs)) {
      signalProcessTree(managed, 'SIGKILL');
    } else if (process.platform === 'win32') {
      signalProcessTree(managed, 'SIGKILL');
    }
  }

  if (await closedWithin(managed, forceMs)) return true;

  // Do not let inherited stdio pipes keep the test runner alive if the OS cannot
  // report process closure promptly. The tree has already received a forced kill.
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
  return false;
}

module.exports = { spawnCaptured };
