'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const CORE = process.env.FLOW_NFLOW_BIN || '';
const input = fs.readFileSync(path.join(ROOT, 'test/fixtures/template-render-input.nflow'), 'utf8');
const expectedFixture = fs.readFileSync(path.join(ROOT, 'test/fixtures/template-render-expected.nflow'), 'utf8');

function formatWithCore(source) {
  const result = spawnSync(CORE, ['fmt', '--stdin'], {
    input: source,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function templateLiteral(source) {
  const match = source.match(/^\s*template:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/m);
  assert.ok(match, 'expected the template field to remain one quoted string');
  return match[1];
}

test('real Flow v0.43.0 formatter preserves template.render text and remains idempotent', { skip: !CORE }, () => {
  const version = spawnSync(CORE, ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /version:\s+v0\.43\.0\b/);

  const formatted = formatWithCore(input);
  assert.equal(formatted, expectedFixture);
  assert.equal(templateLiteral(formatted), templateLiteral(input));
  for (const token of ['{{.customer}}', '{{range .items}}', '{{.}}', '{{end}}']) {
    assert.ok(formatted.includes(token), `formatted template lost ${token}`);
  }
  assert.equal(formatWithCore(formatted), formatted, 'the second formatter pass must be byte-identical');
});
