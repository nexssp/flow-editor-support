'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const RELEASED_CORE = process.env.FLOW_NFLOW_BIN || '';
const PATCHED_CORE = process.env.FLOW_NFLOW_PATCHED_BIN || '';
const input = fs.readFileSync(path.join(ROOT, 'test/fixtures/template-render-input.nflow'), 'utf8');
const expectedFixture = fs.readFileSync(path.join(ROOT, 'test/fixtures/template-render-expected.nflow'), 'utf8');

function runFormatter(core, source) {
  return spawnSync(core, ['fmt', '--stdin'], {
    input: source,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function templateLiteral(source) {
  const match = source.match(/^\s*template:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/m);
  assert.ok(match, 'expected the template field to remain one quoted string');
  return match[1];
}

test('released Flow v0.44.1 promptly reports its known blank-line template limitation', { skip: !RELEASED_CORE }, () => {
  const version = spawnSync(RELEASED_CORE, ['--version'], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(version.error);
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /version:\s+v0\.44\.1\b/);

  const result = runFormatter(RELEASED_CORE, input);
  assert.ifError(result.error);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.stdout, '');
  assert.ok(result.stderr.includes("unterminated argument block; expected '}'"), result.stderr);
});

test('patched Flow formatter preserves template.render text and is idempotent', { skip: !PATCHED_CORE }, () => {
  const formattedResult = runFormatter(PATCHED_CORE, input);
  assert.ifError(formattedResult.error);
  assert.equal(formattedResult.status, 0, formattedResult.stderr);
  const formatted = formattedResult.stdout;
  assert.equal(formatted, expectedFixture);
  assert.equal(templateLiteral(formatted), templateLiteral(input));
  for (const token of ['{{.customer}}', '{{range .items}}', '{{.}}', '{{end}}']) {
    assert.ok(formatted.includes(token), `formatted template lost ${token}`);
  }
  const secondPass = runFormatter(PATCHED_CORE, formatted);
  assert.ifError(secondPass.error);
  assert.equal(secondPass.status, 0, secondPass.stderr);
  assert.equal(secondPass.stdout, formatted, 'the second formatter pass must be byte-identical');
});
