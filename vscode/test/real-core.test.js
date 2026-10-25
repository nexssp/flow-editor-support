'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const Module = require('node:module');

const FLOW_NFLOW_BIN = process.env.FLOW_NFLOW_BIN || '';
const registrations = {};
let settings = {};
class Range { constructor(...values) { this.values = values; } }
class TextEdit { constructor(range, newText) { this.range = range; this.newText = newText; } }
const vscodeMock = {
  Range,
  TextEdit,
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: key => settings[key] }),
  },
  window: {
    activeTextEditor: undefined,
    showErrorMessage: message => { throw new Error(message); },
  },
  languages: {
    registerCompletionItemProvider: () => ({ dispose() {} }),
    registerHoverProvider: () => ({ dispose() {} }),
    registerDocumentFormattingEditProvider: (id, provider) => {
      registrations.languageId = id;
      registrations.formatter = provider;
      return { dispose() {} };
    },
  },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  return originalLoad.call(this, request, parent, isMain);
};
const extension = require('../extension.js');
Module._load = originalLoad;

test('VS Code formatting provider reaches the bundled LSP and real Flow v0.43.0 formatter', { skip: !FLOW_NFLOW_BIN }, async () => {
  const version = spawnSync(FLOW_NFLOW_BIN, ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  const versionMatch = version.stdout.match(/version:\s+v(\d+)\.(\d+)\.(\d+)/);
  assert.ok(versionMatch, `could not read Flow version from: ${version.stdout}`);
  assert.ok(Number(versionMatch[1]) > 0 || Number(versionMatch[2]) >= 43,
    `Flow ${versionMatch[0]} is too old; install v0.43.0 or newer`);

  const source = '@pipeline work:timeout=2s:retry=3\n  action.node:retry=2\n@end';
  const expected = spawnSync(FLOW_NFLOW_BIN, ['fmt', '--stdin'], { input: source, encoding: 'utf8' });
  assert.equal(expected.status, 0, expected.stderr);
  settings = {
    'languageServer.command': '',
    'languageServer.args': [],
    'nflowCommand': FLOW_NFLOW_BIN,
  };
  const context = { extensionPath: path.resolve(__dirname, '..'), subscriptions: [] };
  const document = {
    uri: { toString: () => 'file:///real-core-flow.nflow' },
    getText: () => source,
  };
  try {
    extension.activate(context);
    assert.equal(registrations.languageId, 'nexss-flow');
    const edits = await registrations.formatter.provideDocumentFormattingEdits(document);
    assert.equal(edits.length, 1);
    assert.ok(edits[0].range instanceof Range);
    assert.equal(edits[0].newText, expected.stdout);
  } finally {
    await extension.deactivate();
    settings = {};
  }
});
