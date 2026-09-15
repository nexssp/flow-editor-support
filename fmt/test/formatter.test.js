const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { format } = require('../index.js');

const dir = path.join(__dirname, 'fixtures');
for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.flow') && !name.endsWith('.expected.flow'))) {
  test(`formats and is idempotent: ${name}`, () => {
    const input = fs.readFileSync(path.join(dir, name), 'utf8');
    const expected = fs.readFileSync(path.join(dir, name.replace(/\.flow$/, '.expected.flow')), 'utf8');
    const actual = format(input);
    assert.equal(actual, expected);
    assert.equal(format(actual), actual);
  });
}

test('preserves BOM and CRLF', () => {
  const input = '\uFEFFa->b\r\n';
  const output = format(input);
  assert.equal(output, '\uFEFFa -> b\r\n');
});
