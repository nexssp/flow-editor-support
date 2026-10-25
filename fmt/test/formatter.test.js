'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { format, runNflow } = require('../index.js');
const { createNflowMock, readCalls } = require('./helpers.js');

const cli = path.join(__dirname, '..', 'cli.js');

test('format delegates to nflow fmt and returns its readable multiline output verbatim', t => {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const pipelineInput = fs.readFileSync(path.join(fixtureDir, 'pipeline.nflow'), 'utf8');
  const pipelineExpected = fs.readFileSync(path.join(fixtureDir, 'pipeline.expected.nflow'), 'utf8');
  const inlineInput = 'runtime.const:timeout=1s:retry=2\n';
  const inlineExpected = 'runtime.const :timeout=1s :retry=2\n';
  const input = pipelineInput + inlineInput;
  const expected = pipelineExpected + inlineExpected;
  const mock = createNflowMock(t, { outputs: { [input]: expected } });
  assert.equal(format(input, { env: mock.env }), expected);
  assert.deepEqual(readCalls(mock), [{ args: ['fmt', '--stdin'], input }]);
});

test('the configured nflow executable is used and no editor style options are added', t => {
  const mock = createNflowMock(t);
  const result = runNflow(['--check', 'sample.nflow'], { command: mock.executable, env: mock.env });
  assert.equal(result.status, 0);
  assert.deepEqual(readCalls(mock), [{ args: ['fmt', '--check', 'sample.nflow'], input: '' }]);
});

test('missing nflow reports the core dependency instead of falling back to another formatter', () => {
  assert.throws(
    () => format('noop\n', { command: path.join(osTempDirectory(), 'not-installed-nflow') }),
    /Install a Flow build that provides `nflow fmt`/,
  );
});

test('nflow formatter failures are returned to the caller without hiding diagnostics', t => {
  const mock = createNflowMock(t, { exitCode: 2, stderr: 'invalid Flow syntax\n' });
  assert.throws(() => format('broken\n', { env: mock.env }), /nflow fmt --stdin failed with exit code 2: invalid Flow syntax/);
});

test('flowfmt CLI transparently forwards file operations to nflow fmt', t => {
  const mock = createNflowMock(t);
  const result = spawnSync(process.execPath, [cli, '--write', 'file with spaces.nflow'], {
    env: mock.env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readCalls(mock), [{ args: ['fmt', '--write', 'file with spaces.nflow'], input: '' }]);
});

test('flowfmt CLI transparently forwards stdin requests to nflow fmt', t => {
  const input = 'source -> action :timeout=2s\n';
  const expected = 'source\n  :timeout=2s\n-> action\n';
  const mock = createNflowMock(t, { outputs: { [input]: expected } });
  const result = spawnSync(process.execPath, [cli, '--stdin'], {
    env: mock.env,
    input,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.deepEqual(readCalls(mock), [{ args: ['fmt', '--stdin'], input }]);
});

function osTempDirectory() {
  return require('node:os').tmpdir();
}
