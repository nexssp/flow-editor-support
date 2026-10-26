'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const ROOT = path.resolve(__dirname, '..');
const INPUT_FIXTURE = path.join(ROOT, 'test/fixtures/template-render-input.nflow');
const grammarPaths = {
  'VS Code': path.join(ROOT, 'vscode/syntaxes/flow.tmLanguage.json'),
  JetBrains: path.join(ROOT, 'jetbrains/textmate/nexss-flow.tmLanguage.json'),
};
const pythonGrammar = {
  scopeName: 'source.python',
  patterns: [
    { name: 'comment.line.number-sign.python', begin: '#', end: '$' },
    { name: 'string.quoted.single.python', begin: "'", end: "'", patterns: [{ name: 'constant.character.escape.python', match: '\\\\.' }] },
    { name: 'string.quoted.double.python', begin: '"', end: '"', patterns: [{ name: 'constant.character.escape.python', match: '\\\\.' }] },
    { name: 'keyword.control.python', match: '\\b(import|from|def|return|print)\\b' },
  ],
};
const embeddedLanguageSpecs = [
  { family: 'rust', scope: 'rust', blockTag: 'rust', inlineTag: 'rs', keyword: 'fn', keywordPattern: '\\b(fn|let|mut|return)\\b' },
  { family: 'php', scope: 'php', blockTag: 'php', inlineTag: 'php', keyword: 'function', keywordPattern: '\\b(function|echo|return)\\b' },
  { family: 'typescript', scope: 'typescript', blockTag: 'typescript', inlineTag: 'ts', keyword: 'interface', keywordPattern: '\\b(interface|const|return)\\b' },
  { family: 'javascript', scope: 'javascript', blockTag: 'javascript', inlineTag: 'js', keyword: 'const', keywordPattern: '\\b(const|function|return)\\b' },
  { family: 'go', scope: 'go', blockTag: 'go', inlineTag: 'golang', keyword: 'func greet', keywordPattern: '\\b(func|package|return)\\b' },
];
const embeddedGrammars = Object.fromEntries(embeddedLanguageSpecs.map(({ scope, keywordPattern }) => {
  const lang = scope;
  return [`source.${scope}`, {
    scopeName: `source.${scope}`,
    patterns: [
      { name: `comment.line.double-slash.${lang}`, begin: '//', end: '$' },
      { name: `comment.block.${lang}`, begin: '/\\*', end: '\\*/' },
      ...(scope === 'rust' ? [] : [{ name: `string.quoted.single.${lang}`, begin: "'", end: "'" }]),
      { name: `string.quoted.double.${lang}`, begin: '"', end: '"' },
      { name: `string.quoted.other.${lang}`, begin: '`', end: '`' },
      { name: `keyword.control.${lang}`, match: keywordPattern },
    ],
  }];
}));
let grammars;

test.before(async () => {
  const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');
  const wasm = fs.readFileSync(wasmPath);
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  grammars = {};
  for (const [editor, grammarPath] of Object.entries(grammarPaths)) {
    const registry = new textmate.Registry({
      onigLib: Promise.resolve({
        createOnigScanner: sources => new oniguruma.OnigScanner(sources),
        createOnigString: source => new oniguruma.OnigString(source),
      }),
      loadGrammar: async scopeName => {
        if (scopeName === 'source.nflow') {
          return textmate.parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), grammarPath);
        }
        if (scopeName === 'source.python') {
          return textmate.parseRawGrammar(JSON.stringify(pythonGrammar), `${editor}-python-test.tmLanguage.json`);
        }
        if (embeddedGrammars[scopeName]) {
          return textmate.parseRawGrammar(JSON.stringify(embeddedGrammars[scopeName]), `${editor}-${scopeName}-test.tmLanguage.json`);
        }
        return null;
      },
    });
    grammars[editor] = await registry.loadGrammar('source.nflow');
  }
});

function tokenize(source, grammar) {
  const tokens = [];
  let state = textmate.INITIAL;
  let offset = 0;
  for (const line of source.split('\n')) {
    const result = grammar.tokenizeLine(line, state);
    state = result.ruleStack;
    for (const token of result.tokens) {
      tokens.push({
        text: line.slice(token.startIndex, token.endIndex),
        start: offset + token.startIndex,
        end: offset + token.endIndex,
        scopes: token.scopes,
      });
    }
    offset += line.length + 1;
  }
  return tokens;
}

function tokenFor(tokens, source, needle, occurrence = 0) {
  let from = 0;
  let index = -1;
  for (let n = 0; n <= occurrence; n++) {
    index = source.indexOf(needle, from);
    assert.notEqual(index, -1, `missing ${JSON.stringify(needle)} occurrence ${n}`);
    from = index + needle.length;
  }
  return tokenAt(tokens, index);
}

function tokenAt(tokens, offset) {
  const token = tokens.find(item => item.start <= offset && item.end > offset);
  assert.ok(token, `no TextMate token at ${offset}`);
  return token;
}

function assertScope(tokens, source, needle, scope, occurrence = 0) {
  const token = tokenFor(tokens, source, needle, occurrence);
  assert.ok(token.scopes.includes(scope), `${JSON.stringify(needle)} has scopes ${token.scopes.join(' ')}; expected ${scope}`);
  return token;
}

function assertThemeScope(tokens, source, needle, scopePrefix, occurrence = 0) {
  const token = tokenFor(tokens, source, needle, occurrence);
  assert.ok(token.scopes.some(scope => scope === scopePrefix || scope.startsWith(`${scopePrefix}.`)),
    `${JSON.stringify(needle)} has scopes ${token.scopes.join(' ')}; expected theme-compatible ${scopePrefix} scope`);
  return token;
}

for (const editor of Object.keys(grammarPaths)) {
  test(`${editor}: inline Python uses the embedded Python grammar and leaves Flow syntax visible`, () => {
    const source = fs.readFileSync(path.join(ROOT, 'test/fixtures/python-inline.nflow'), 'utf8');
    const tokens = tokenize(source, grammars[editor]);
    assertScope(tokens, source, 'py', 'keyword.control.language.nflow');
    assertScope(tokens, source, 'import', 'keyword.control.python');
    assertScope(tokens, source, 'print', 'keyword.control.python');
    assertScope(tokens, source, 'Braces in Python text are not Flow delimiters: { and }', 'string.quoted.double.python');
    assertThemeScope(tokens, source, 'mean', 'string.quoted');
    const dictionaryClose = tokenAt(tokens, source.indexOf('}\nlabel = f'));
    assert.ok(dictionaryClose.scopes.includes('punctuation.section.block.end.python'),
      `nested Python dictionary close has scopes ${dictionaryClose.scopes.join(' ')}`);
    const afterBlock = tokenAt(tokens, source.indexOf('-> runtime.noop'));
    assert.ok(afterBlock.scopes.includes('keyword.operator.nflow'),
      `Flow operator after Python block has scopes ${afterBlock.scopes.join(' ')}`);
    const pathKeyword = tokenFor(tokens, source, 'py.file');
    assert.ok(!pathKeyword.scopes.includes('meta.embedded.inline.python.nflow'));
  });

  test(`${editor}: Rust, PHP, TypeScript, JavaScript, and Go blocks and inline forms reuse editor grammars`, () => {
    const source = fs.readFileSync(path.join(ROOT, 'test/fixtures/embedded-languages.nflow'), 'utf8');
    const tokens = tokenize(source, grammars[editor]);
    for (const language of embeddedLanguageSpecs) {
      const blockTag = assertScope(tokens, source, language.blockTag, `meta.embedded.block.${language.family}.nflow`);
      assert.ok(blockTag.scopes.includes('keyword.control.language.nflow'));
      assertScope(tokens, source, language.keyword, `keyword.control.${language.scope}`);
      const inlineOffset = source.lastIndexOf(`-> ${language.inlineTag}`) + 3;
      const inlineTag = tokenAt(tokens, inlineOffset);
      assert.ok(inlineTag.scopes.includes(`meta.embedded.inline.${language.family}.nflow`),
        `${JSON.stringify(language.inlineTag)} has scopes ${inlineTag.scopes.join(' ')}; expected inline ${language.family} scope`);
      assert.ok(inlineTag.scopes.includes('keyword.control.language.nflow'));
    }
    assertScope(tokens, source, 'Rust { string }', 'string.quoted.double.rust');
    assertScope(tokens, source, 'PHP { string }', 'string.quoted.double.php');
    assertScope(tokens, source, 'JavaScript { string }', 'string.quoted.double.javascript');
    const flowArrow = tokenFor(tokens, source, '-> php');
    assert.ok(flowArrow.scopes.includes('keyword.operator.nflow'),
      `Flow operator after Rust block has scopes ${flowArrow.scopes.join(' ')}`);
    assert.ok(!flowArrow.scopes.includes('meta.embedded.block.rust.nflow'));
  });

  test(`${editor}: supplied template.render sample has distinct embedded Go template scopes`, () => {
    const source = fs.readFileSync(INPUT_FIXTURE, 'utf8');
    const tokens = tokenize(source, grammars[editor]);
    assertScope(tokens, source, 'template.render', 'entity.name.function.nflow');
    assertScope(tokens, source, '{{', 'punctuation.section.embedded.begin.go-template');
    assertThemeScope(tokens, source, '{{', 'punctuation.section.embedded');
    assertScope(tokens, source, '}}', 'punctuation.section.embedded.end.go-template');
    assertThemeScope(tokens, source, '}}', 'punctuation.section.embedded');
    assertScope(tokens, source, '.customer', 'variable.other.go-template');
    assertThemeScope(tokens, source, '.customer', 'variable.other');
    assertScope(tokens, source, '.order_id', 'variable.other.go-template');
    assertThemeScope(tokens, source, '.order_id', 'variable.other');
    assertScope(tokens, source, '.items', 'variable.other.go-template');
    const standaloneDot = tokenAt(tokens, source.indexOf('{{.}}') + 2);
    assert.equal(standaloneDot.text, '.');
    assert.ok(standaloneDot.scopes.includes('variable.language.go-template'));
    assert.ok(standaloneDot.scopes.some(scope => scope === 'variable.language' || scope.startsWith('variable.language.')),
      `standalone dot has scopes ${standaloneDot.scopes.join(' ')}; expected theme-compatible variable.language scope`);
    assertScope(tokens, source, 'range', 'keyword.control.go-template');
    assertThemeScope(tokens, source, 'range', 'keyword.control');
    assertScope(tokens, source, 'end', 'keyword.control.go-template', 1);
    assertThemeScope(tokens, source, 'end', 'keyword.control', 1);
    const body = tokenFor(tokens, source, 'Hi ');
    assert.ok(body.scopes.includes('string.quoted.double.nflow'));
    assert.ok(!body.scopes.includes('meta.embedded.inline.go-template'));
  });

  test(`${editor}: ordinary, neighboring, and nested object strings remain plain Flow strings`, () => {
    const source = fs.readFileSync(path.join(ROOT, 'test/fixtures/template-render-contexts.nflow'), 'utf8');
    const tokens = tokenize(source, grammars[editor]);
    const ignored = [...source.matchAll(/\.ignored/g)];
    assert.equal(ignored.length, 4);
    for (let n = 0; n < ignored.length; n++) {
      const token = tokenFor(tokens, source, '.ignored', n);
      assert.ok(!token.scopes.includes('variable.other.go-template'), `unexpected Go-template scope for ordinary .ignored at ${token.start}`);
      assert.ok(!token.scopes.includes('meta.embedded.inline.go-template'));
    }
    assertScope(tokens, source, '.visible', 'variable.other.go-template');
    const ordinaryCall = tokenFor(tokens, source, 'ordinary.call');
    assert.ok(!ordinaryCall.scopes.includes('meta.function-call.template-render.nflow'));
  });

  test(`${editor}: single-quoted and backtick template values support actions and trim markers`, () => {
    const source = "template.render @{ template: 'Hello {{- if .ok -}}yes{{else}}no{{end}}' }\n"
      + 'template.render @{ template: `Hello {{.value}}` }\n';
    const tokens = tokenize(source, grammars[editor]);
    assertScope(tokens, source, '{{', 'punctuation.section.embedded.begin.go-template');
    assertScope(tokens, source, 'if', 'keyword.control.go-template');
    assertScope(tokens, source, '.ok', 'variable.other.go-template');
    assertScope(tokens, source, 'end', 'keyword.control.go-template', 1);
    assertScope(tokens, source, '.value', 'variable.other.go-template');
    const trimMarker = tokenAt(tokens, source.indexOf('{{-') + 2);
    assert.equal(trimMarker.text, '-');
    assert.ok(trimMarker.scopes.includes('keyword.operator.whitespace-trim.go-template'));
  });
}
