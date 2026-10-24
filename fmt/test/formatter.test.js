const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { format } = require('../index.js');

const dir = path.join(__dirname, 'fixtures');
for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.nflow') && !name.endsWith('.expected.nflow'))) {
  test(`formats and is idempotent: ${name}`, () => {
    const input = fs.readFileSync(path.join(dir, name), 'utf8');
    const expected = fs.readFileSync(path.join(dir, name.replace(/\.nflow$/, '.expected.nflow')), 'utf8');
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

test('preserves whitespace-significant ternary else separators', () => {
  assert.equal(format('true?noop : noop\n'), 'true ? noop : noop\n');
});

test('leaves backtick strings and inline comments unchanged', () => {
  const input = 'action.node:note=`x -> y // z: q`->next.node // keep -> exact\n';
  const expected = 'action.node:note=`x -> y // z: q` -> next.node // keep -> exact\n';
  assert.equal(format(input), expected);
});

test('does not treat expression predicates as comments', () => {
  const input = '@assert {\nresult.count>0\nall(result.items,# != "")\n}\n';
  const expected = '@assert {\n  result.count > 0\n  all(result.items, # != "")\n}\n';
  assert.equal(format(input), expected);
});

test('formats Flow v0.42 single-expression and compact assertion directives', () => {
  const input = '@assert: result.count>0\n@assert result.items[0]=="a,b"\n';
  const expected = '@assert: result.count > 0\n@assert result.items[0] == "a,b"\n';
  assert.equal(format(input), expected);
  assert.equal(format(expected), expected);

  const compact = '@assert:{len(result.tags)==2,all(result.tags,#!=""),result.tags[0]=="a,b"}\n';
  const compactExpected = '@assert: { len(result.tags) == 2, all(result.tags, # != ""), result.tags[0] == "a,b" }\n';
  assert.equal(format(compact), compactExpected);
  assert.equal(format(compactExpected), compactExpected);
  assert.equal(format('@assertion foo==bar\n'), '@assertion foo==bar\n');
});

test('uses canonical spacing for named fields without altering race modifiers', () => {
  const input = 'parallel {\nprofile:const @{ value:"x" },\n}\n';
  const expected = 'parallel {\n  profile: const @{ value: "x" },\n}\n';
  assert.equal(format(input), expected);
  assert.equal(format(input, { indentWidth: 4, insertSpaces: false }), expected);
  assert.equal(format(expected), expected);

  const race = 'source -> race {\nconst:timeout=10s,\n}\n';
  assert.equal(format(race), 'source -> race {\n  const:timeout=10s,\n}\n');
});

test('preserves whole-line hash comments and empty objects', () => {
  assert.equal(format('# keep this comment\n{}->noop\n'), '# keep this comment\n{} -> noop\n');
});

test('ignores quoted braces when indenting following lines', () => {
  const input = 'const @{ value: "literal { brace" }\nnoop\n';
  assert.equal(format(input), input);
});

test('preserves multiline string content and comment-like text', () => {
  const input = 'const @{ value: "first { line\n  second -> // literal : text\nthird }" }\n';
  assert.equal(format(input), input);
});

test('rejects style overrides so flowfmt stays canonical', () => {
  const cli = path.join(__dirname, '..', 'cli.js');
  for (const flag of ['--print-width', '--indent-width', '--no-blank-lines']) {
    const result = spawnSync(process.execPath, [cli, flag, '--stdin'], { input: '', encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, new RegExp(`unknown option: ${flag}`));
  }
});
