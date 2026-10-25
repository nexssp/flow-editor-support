'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const registrations = {};
let settings = {};
class MockLanguageClient {
  constructor(id, name, serverOptions, clientOptions) {
    Object.assign(registrations, { id, name, serverOptions, clientOptions, client: this });
  }
  async start() { registrations.started = true; }
  async stop() { registrations.stopped = true; }
}
const vscodeMock = {
  workspace: {
    getConfiguration: () => ({ get: key => settings[key] }),
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  if (request === 'vscode-languageclient/node') return { LanguageClient: MockLanguageClient };
  return originalLoad.call(this, request, parent, isMain);
};
const extension = require('../extension.js');
Module._load = originalLoad;

function reset() {
  for (const key of Object.keys(registrations)) delete registrations[key];
}

test('VS Code starts the shared native-core launcher and forwards the selected binary', async () => {
  reset();
  settings = { nflowCommand: '/opt/flow tools/nflow' };
  const extensionPath = path.resolve(__dirname, '..');
  const context = { extensionPath, subscriptions: [] };
  try {
    await extension.activate(context);
    assert.equal(registrations.id, 'nexss-flow');
    assert.equal(registrations.name, 'Nexss Flow');
    assert.equal(registrations.started, true);
    assert.equal(registrations.serverOptions.command, process.execPath);
    assert.equal(registrations.serverOptions.args[0], path.join(extensionPath, 'lsp', 'nflow-lsp.js'));
    assert.equal(registrations.serverOptions.options.env.NFLOW_BIN, '/opt/flow tools/nflow');
    assert.deepEqual(registrations.clientOptions.documentSelector, [
      { scheme: 'file', language: 'nexss-flow' },
    ]);
    assert.equal(context.subscriptions[0], registrations.client);
  } finally {
    await extension.deactivate();
    settings = {};
  }
  assert.equal(registrations.stopped, true);
});

test('VS Code preserves an explicit custom language-server override', async () => {
  reset();
  settings = {
    'languageServer.command': '/custom/language server',
    'languageServer.args': ['--stdio', 'arg with spaces'],
    nflowCommand: '',
  };
  try {
    await extension.activate({ extensionPath: path.resolve(__dirname, '..'), subscriptions: [] });
    assert.equal(registrations.serverOptions.command, '/custom/language server');
    assert.deepEqual(registrations.serverOptions.args, ['--stdio', 'arg with spaces']);
    assert.equal(registrations.serverOptions.options.env.NFLOW_BIN, process.env.NFLOW_BIN);
  } finally {
    await extension.deactivate();
    settings = {};
  }
});
