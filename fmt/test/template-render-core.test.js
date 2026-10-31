'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const RELEASED_CORE = process.env.NFLOW_BIN || '';
const inputPath = path.join(ROOT, 'test/fixtures/template-render-input.nflow');
const expectedPath = path.join(ROOT, 'test/fixtures/template-render-expected.nflow');
const input = fs.readFileSync(inputPath, 'utf8');
const expectedFixture = fs.readFileSync(expectedPath, 'utf8');
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
test('Flow core formats multiline template.render input with --check and preserves its text', { skip: !RELEASED_CORE }, () => {
  const check = spawnSync(RELEASED_CORE, ['fmt', '--check', inputPath], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(check.error);
  assert.equal(check.status, 1, `${check.stdout}\n${check.stderr}`);
  assert.match(check.stderr, /not formatted/);

  const formattedCheck = spawnSync(RELEASED_CORE, ['fmt', '--check', expectedPath], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(formattedCheck.error);
  assert.equal(formattedCheck.status, 0, `${formattedCheck.stdout}\n${formattedCheck.stderr}`);

  const formattedResult = runFormatter(RELEASED_CORE, input);
  assert.ifError(formattedResult.error);
  assert.equal(formattedResult.status, 0, formattedResult.stderr);
  const formatted = formattedResult.stdout;
  assert.equal(formatted, expectedFixture);
  assert.equal(templateLiteral(formatted), templateLiteral(input));
  for (const token of ['{{.customer}}', '{{range .items}}', '{{.}}', '{{end}}']) {
    assert.ok(formatted.includes(token), `formatted template lost ${token}`);
  }
  const secondPass = runFormatter(RELEASED_CORE, formatted);
  assert.ifError(secondPass.error);
  assert.equal(secondPass.status, 0, secondPass.stderr);
  assert.equal(secondPass.stdout, formatted, 'the second formatter pass must be byte-identical');
});
