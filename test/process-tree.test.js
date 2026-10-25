'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnCaptured } = require('./helpers/process-tree');

async function waitForGrandchildPid(managed, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  const pattern = /grandchild=(\d+)/;
  while (Date.now() < deadline) {
    const match = Buffer.concat(managed.stdout).toString('utf8').match(pattern);
    if (match) return Number(match[1]);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`test child did not report its descendant PID${managed.diagnostics() ? `\n${managed.diagnostics()}` : ''}`);
}

test('process-tree cleanup force-kills descendants that ignore TERM and hold stdio open', {
  skip: process.platform === 'win32',
  timeout: 5000,
}, async t => {
  const grandchildCode = "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);";
  const parentCode = [
    "const { spawn } = require('node:child_process');",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildCode)}], { stdio: 'inherit' });`,
    "process.stdout.write('grandchild=' + child.pid + '\\n');",
    "process.on('SIGTERM', () => {});",
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const managed = spawnCaptured(process.execPath, ['-e', parentCode]);
  t.after(async () => {
    if (!await managed.stop({ graceMs: 100, forceMs: 1000 })) {
      t.diagnostic('Regression-test process tree remained open after the forced-kill deadline.');
    }
  });

  const grandchildPid = await waitForGrandchildPid(managed);
  assert.ok(grandchildPid > 0);
  assert.equal(await managed.stop({ graceMs: 100, forceMs: 1500 }), true, managed.diagnostics());
  assert.equal(managed.closeResult.signal, 'SIGKILL', 'cleanup must escalate after the TERM grace period');
});
