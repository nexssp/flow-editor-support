'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const registrations = {};
const outputChannels = {};
const commands = {};
let settings = {};
let configurationListener;
let execFileCalls = [];
let execFileResult = { stdout: '', stderr: '' };
const childProcessMock = {
  execFile: (executable, args, options, callback) => {
    execFileCalls.push({ executable, args, options });
    callback(execFileResult.error || null, execFileResult.stdout, execFileResult.stderr);
  },
};
class MockLanguageClient {
  constructor(id, name, serverOptions, clientOptions) {
    Object.assign(registrations, { id, name, serverOptions, clientOptions, client: this });
  }
  async start() { registrations.started = true; }
  async setTrace(level) { registrations.trace = level; }
  async stop() { registrations.stopped = true; }
}
const vscodeMock = {
  workspace: {
    getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }),
    onDidChangeConfiguration: listener => {
      configurationListener = listener;
      return { dispose() {} };
    },
  },
  window: {
    createOutputChannel: name => {
      const channel = {
        name,
        lines: [],
        shown: false,
        clear() { this.lines = []; },
        appendLine(line) { this.lines.push(line); },
        show() { this.shown = true; },
        dispose() {},
      };
      outputChannels[name] = channel;
      return channel;
    },
  },
  commands: {
    registerCommand: (name, callback) => {
      commands[name] = callback;
      return { dispose() {} };
    },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  if (request === 'node:child_process') return childProcessMock;
  if (request === 'vscode-languageclient/node') return {
    LanguageClient: MockLanguageClient,
    RevealOutputChannelOn: { Error: 3 },
    Trace: { Off: 0, Messages: 1, Verbose: 3 },
  };
  return originalLoad.call(this, request, parent, isMain);
};
const extension = require('../extension.js');
Module._load = originalLoad;

function reset() {
  for (const key of Object.keys(registrations)) delete registrations[key];
  for (const key of Object.keys(outputChannels)) delete outputChannels[key];
  for (const key of Object.keys(commands)) delete commands[key];
  configurationListener = undefined;
  execFileCalls = [];
  execFileResult = { stdout: '', stderr: '' };
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
    assert.equal(registrations.clientOptions.outputChannel, outputChannels['Nexss Flow Language Server']);
    assert.equal(registrations.clientOptions.traceOutputChannel, outputChannels['Nexss Flow LSP Trace']);
    assert.equal(registrations.clientOptions.revealOutputChannelOn, 3);
    assert.equal(registrations.trace, 0);
    assert.ok(context.subscriptions.includes(registrations.client));
    assert.equal(typeof commands['nexssFlow.showLanguageServerOutput'], 'function');
    commands['nexssFlow.showLanguageServerOutput']();
    assert.equal(outputChannels['Nexss Flow Language Server'].shown, true);
  } finally {
    await extension.deactivate();
    settings = {};
  }
  assert.equal(registrations.stopped, true);
});

test('VS Code applies and updates the configured LSP trace level', async () => {
  reset();
  settings = { 'trace.server': 'messages' };
  try {
    await extension.activate({ extensionPath: path.resolve(__dirname, '..'), subscriptions: [] });
    assert.equal(registrations.trace, 1);
    settings = { 'trace.server': 'verbose' };
    configurationListener({ affectsConfiguration: name => name === 'nexssFlow.trace.server' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(registrations.trace, 3);
    commands['nexssFlow.showLanguageServerTrace']();
    assert.equal(outputChannels['Nexss Flow LSP Trace'].shown, true);
  } finally {
    await extension.deactivate();
    settings = {};
  }
});

test('VS Code reports the configured Flow executable and its version', async () => {
  reset();
  settings = { nflowCommand: '/opt/flow tools/nflow' };
  execFileResult = { stdout: 'nflow version: v0.52.0\n', stderr: '' };
  try {
    await extension.activate({ extensionPath: path.resolve(__dirname, '..'), subscriptions: [] });
    assert.equal(typeof commands['nexssFlow.showFlowExecutable'], 'function');
    await commands['nexssFlow.showFlowExecutable']();
    assert.deepEqual(execFileCalls[0], {
      executable: '/opt/flow tools/nflow',
      args: ['--version'],
      options: { encoding: 'utf8', timeout: 5000, windowsHide: true },
    });
    assert.deepEqual(outputChannels['Nexss Flow Executable'].lines, [
      'Configured Flow executable: /opt/flow tools/nflow',
      'nflow version: v0.52.0',
    ]);
    assert.equal(outputChannels['Nexss Flow Executable'].shown, true);
  } finally {
    await extension.deactivate();
    settings = {};
  }
});

test('VS Code executable diagnostic preserves legacy environment fallback aliases and reports failures', async () => {
  reset();
  settings = { nflowCommand: '' };
  const savedEnvironment = Object.fromEntries(
    ['NFLOW_BIN', 'FLOW_NFLOW_LSP_BIN', 'FLOW_NFLOW_BIN'].map(key => [key, process.env[key]]),
  );
  process.env.NFLOW_BIN = '';
  process.env.FLOW_NFLOW_LSP_BIN = '/env/flow-lsp';
  process.env.FLOW_NFLOW_BIN = '/env/flow-fallback';
  execFileResult = { error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  try {
    await extension.activate({ extensionPath: path.resolve(__dirname, '..'), subscriptions: [] });
    await commands['nexssFlow.showFlowExecutable']();
    assert.equal(execFileCalls[0].executable, '/env/flow-lsp');
    assert.deepEqual(outputChannels['Nexss Flow Executable'].lines, [
      'Configured Flow executable: /env/flow-lsp',
      'Version check failed: spawn ENOENT',
    ]);
  } finally {
    await extension.deactivate();
    settings = {};
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
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
