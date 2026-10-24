const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const registrations = {};
let settings = {};
class SnippetString { constructor(value) { this.value = value; } }
class CompletionItem { constructor(label, kind) { this.label = label; this.kind = kind; } }
class Range { constructor(...values) { this.values = values; } }
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
    registerDocumentFormattingEditProvider: (_id, provider) => { registrations.formatter = provider; return { dispose() {} }; },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  return originalLoad.call(this, request, parent, isMain);
};
const extension = require('../extension.js');
Module._load = originalLoad;

test('VS Code client launches configured stdio LSP and provides snippets, hover, and formatting', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flow extension with spaces '));
  const serverDir = path.join(tempRoot, 'lsp');
  const fmtDir = path.join(tempRoot, 'fmt');
  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(fmtDir, { recursive: true });
  const repoRoot = path.resolve(__dirname, '..', '..');
  fs.copyFileSync(path.join(repoRoot, 'vscode', 'lsp', 'flow-language-server.js'), path.join(serverDir, 'flow-language-server.js'));
  fs.copyFileSync(path.join(repoRoot, 'vscode', 'fmt', 'index.js'), path.join(fmtDir, 'index.js'));
  settings = {
    'languageServer.command': process.execPath,
    'languageServer.args': [path.join(serverDir, 'flow-language-server.js')],
  };
  const context = { extensionPath: path.resolve(__dirname, '..'), subscriptions: [] };
  const document = {
    uri: { toString: () => 'file:///current%20flow.nflow' },
    getText: () => 'true?noop : noop',
  };
  try {
    extension.activate(context);
    const completions = await registrations.completion.provideCompletionItems(document, { line: 0, character: 0 });
    const argsSnippet = completions.find(item => item.label === 'flow-args');
    assert.ok(argsSnippet);
    assert.ok(argsSnippet.insertText instanceof SnippetString);
    assert.match(argsSnippet.insertText.value, /@\{/);
    const assertionSnippet = completions.find(item => item.label === 'flow-assert-inline');
    assert.ok(assertionSnippet);
    assert.ok(assertionSnippet.insertText instanceof SnippetString);
    assert.match(assertionSnippet.insertText.value, /@assert: \{/);

    const hover = await registrations.hover.provideHover(document, { line: 0, character: 0 });
    assert.ok(hover instanceof Hover);
    assert.match(hover.contents.value, /Nexss Flow/);

    const edits = await registrations.formatter.provideDocumentFormattingEdits(document);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, 'true ? noop : noop\n');
    assert.ok(edits[0].range instanceof Range);
  } finally {
    await extension.deactivate();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    settings = {};
  }
});
