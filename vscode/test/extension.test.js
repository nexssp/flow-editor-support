'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { createNflowMock, readCalls } = require('../../fmt/test/helpers.js');

const registrations = {};
let settings = {};
class SnippetString { constructor(value) { this.value = value; } }
class CompletionItem { constructor(label, kind) { this.label = label; this.kind = kind; } }
class Range {
  constructor(...values) {
    this.values = values;
    [this.start, this.end] = [
      { line: values[0], character: values[1] },
      { line: values[2], character: values[3] },
    ];
  }
}
class TextEdit { constructor(range, newText) { this.range = range; this.newText = newText; } }
class MarkdownString { constructor(value) { this.value = value; } }
class Hover { constructor(contents) { this.contents = contents; } }

const vscodeMock = {
  CompletionItem,
  CompletionItemKind: { Keyword: 14, Snippet: 15 },
  SnippetString,
  Range,
  TextEdit,
  MarkdownString,
  Hover,
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: key => settings[key] }),
  },
  window: {
    activeTextEditor: undefined,
    showErrorMessage: () => undefined,
  },
  languages: {
    registerCompletionItemProvider: (_id, provider) => { registrations.completion = provider; return { dispose() {} }; },
    registerHoverProvider: (_id, provider) => { registrations.hover = provider; return { dispose() {} }; },
    registerDocumentFormattingEditProvider: (id, provider) => { registrations.formatterLanguageId = id; registrations.formatter = provider; return { dispose() {} }; },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  return originalLoad.call(this, request, parent, isMain);
};
const extension = require('../extension.js');
Module._load = originalLoad;

function applyCompletion(text, completion) {
  const range = completion.range;
  const offset = position => text.split('\n').slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
  return text.slice(0, offset(range.start)) + completion.insertText.value + text.slice(offset(range.end));
}

test('VS Code providers preserve completion ranges and format through configured nflow', async t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flow extension with spaces '));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const serverDir = path.join(tempRoot, 'lsp');
  const fmtDir = path.join(tempRoot, 'fmt');
  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(fmtDir, { recursive: true });
  const repoRoot = path.resolve(__dirname, '..', '..');
  const serverPath = path.join(serverDir, 'flow-language-server.js');
  fs.copyFileSync(path.join(repoRoot, 'vscode', 'lsp', 'flow-language-server.js'), serverPath);
  fs.copyFileSync(path.join(repoRoot, 'vscode', 'fmt', 'index.js'), path.join(fmtDir, 'index.js'));

  const inputTernary = 'true?noop : noop';
  const outputTernary = 'true ? noop : noop\n';
  const inputPipeline = '@pipeline work:timeout=2s:retry=3\n  action.node:retry=2\n@end';
  const outputPipeline = '@pipeline work\n  :timeout=2s\n  :retry=3\n\n  action.node :retry=2\n@end\n';
  const core = createNflowMock(t, { outputs: {
    [inputTernary]: outputTernary,
    [inputPipeline]: outputPipeline,
  } });
  settings = {
    'languageServer.command': process.execPath,
    'languageServer.args': [serverPath],
    'nflowCommand': core.executable,
  };
  const context = { extensionPath: path.resolve(__dirname, '..'), subscriptions: [] };
  const document = {
    uri: { toString: () => 'file:///current%20flow.nflow' },
    getText: () => inputTernary,
  };
  try {
    extension.activate(context);
    const completions = await registrations.completion.provideCompletionItems(document, { line: 0, character: 0 }, undefined, { triggerKind: 1 });
    const argsSnippet = completions.find(item => item.label === 'flow-args');
    assert.ok(argsSnippet);
    assert.ok(argsSnippet.insertText instanceof SnippetString);
    assert.match(argsSnippet.insertText.value, /@\{/);
    const assertionSnippet = completions.find(item => item.label === 'flow-assert-inline');
    assert.ok(assertionSnippet);
    assert.ok(assertionSnippet.insertText instanceof SnippetString);
    assert.match(assertionSnippet.insertText.value, /@assert: \{/);
    const nodeSnippet = completions.find(item => item.label === 'flow-node');
    assert.match(nodeSnippet.insertText.value, / :timeout=.* :retry=/);
    const pipelineSnippet = completions.find(item => item.label === 'flow-pipeline');
    assert.match(pipelineSnippet.insertText.value, /\n  :timeout=10s\n  :retry=2\n\n/);
    assert.deepEqual(pipelineSnippet.range.values, [0, 0, 0, 0]);

    await t.test('directive completions replace the typed @ instead of duplicating it', async () => {
      const typedAtDocument = {
        uri: { toString: () => 'file:///typed-at.nflow' },
        getText: () => '@',
      };
      const atTriggered = await registrations.completion.provideCompletionItems(
        typedAtDocument, { line: 0, character: 1 }, undefined, { triggerKind: 2, triggerCharacter: '@' }
      );
      for (const [label, directive] of [['flow-pipeline', '@pipeline'], ['flow-assert', '@assert']]) {
        const item = atTriggered.find(completion => completion.label === label);
        assert.ok(item, `${label} completion exists`);
        assert.deepEqual(item.range.values, [0, 0, 0, 1]);
        const inserted = applyCompletion('@', item);
        assert.ok(inserted.startsWith(directive));
        assert.ok(!inserted.startsWith(`@${directive}`), `${label} must replace the typed @, not duplicate it`);
      }
    });

    await t.test('manual snippets keep their @ and non-@ triggers keep zero-width ranges', async () => {
      const manuallyInserted = applyCompletion('', pipelineSnippet);
      assert.ok(manuallyInserted.startsWith('@pipeline'));
      assert.ok(!manuallyInserted.startsWith('@@pipeline'));

      const colonDocument = {
        uri: { toString: () => 'file:///typed-colon.nflow' },
        getText: () => 'x:',
      };
      const colonTriggered = await registrations.completion.provideCompletionItems(
        colonDocument, { line: 0, character: 2 }, undefined, { triggerKind: 2, triggerCharacter: ':' }
      );
      const colonAssert = colonTriggered.find(item => item.label === 'flow-assert');
      assert.deepEqual(colonAssert.range.values, [0, 2, 0, 2]);
      assert.ok(applyCompletion('x:', colonAssert).startsWith('x:@assert'));
    });

    const hover = await registrations.hover.provideHover(document, { line: 0, character: 0 });
    assert.ok(hover instanceof Hover);
    assert.match(hover.contents.value, /Nexss Flow/);

    const edits = await registrations.formatter.provideDocumentFormattingEdits(document);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, outputTernary);
    assert.ok(edits[0].range instanceof Range);

    const pipelineDocument = {
      uri: { toString: () => 'file:///pipeline.nflow' },
      getText: () => inputPipeline,
    };
    const multilineEdits = await registrations.formatter.provideDocumentFormattingEdits(pipelineDocument);
    assert.equal(multilineEdits[0].newText, outputPipeline);
    assert.deepEqual(readCalls(core), [
      { args: ['fmt', '--stdin'], input: inputTernary },
      { args: ['fmt', '--stdin'], input: inputPipeline },
    ]);
  } finally {
    await extension.deactivate();
    settings = {};
  }
});
