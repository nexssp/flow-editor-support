'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnCaptured } = require('./helpers/process-tree');

async function waitForProcessTreeReady(managed, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  const pattern = /grandchild=(\d+)/;
  while (Date.now() < deadline) {
    const output = Buffer.concat(managed.stdout).toString('utf8');
    const match = output.match(pattern);
    if (match && output.includes('parent-ready') && output.includes(`grandchild-ready=${match[1]}`)) {
      return Number(match[1]);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`test process tree did not become ready${managed.diagnostics() ? `\n${managed.diagnostics()}` : ''}`);
}

test('process-tree cleanup force-kills descendants that ignore TERM and hold stdio open', {
  skip: process.platform === 'win32',
  timeout: 5000,
}, async t => {
  const grandchildCode = "process.on('SIGTERM', () => {}); process.stdout.write('grandchild-ready=' + process.pid + '\\n'); setInterval(() => {}, 1000);";
  const parentCode = [
    "const { spawn } = require('node:child_process');",
    "process.on('SIGTERM', () => {});",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildCode)}], { stdio: 'inherit' });`,
    "process.stdout.write('grandchild=' + child.pid + '\\n');",
    "process.stdout.write('parent-ready\\n');",
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const managed = spawnCaptured(process.execPath, ['-e', parentCode]);
  t.after(async () => {
    if (!await managed.stop({ graceMs: 100, forceMs: 1000 })) {
      t.diagnostic('Regression-test process tree remained open after the forced-kill deadline.');
    }
  });

  const grandchildPid = await waitForProcessTreeReady(managed);
  assert.ok(grandchildPid > 0);
  assert.equal(await managed.stop({ graceMs: 100, forceMs: 1500 }), true, managed.diagnostics());
  assert.equal(managed.closeResult.signal, 'SIGKILL', 'cleanup must escalate after the TERM grace period');
});
