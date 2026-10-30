'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { spawnCaptured } = require('../../test/helpers/process-tree');

const CORE = process.env.NFLOW_BIN || process.env.FLOW_NFLOW_LSP_BIN || process.env.FLOW_NFLOW_BIN || '';
const EXTENSION_PATH = path.resolve(__dirname, '..');
const LAUNCHER = path.join(EXTENSION_PATH, 'lsp', 'nflow-lsp.js');

const settings = {};
const channels = {};
const registeredCommands = {};
const registrations = {};

const vscodeMock = {
  workspace: {
    getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
  },
  window: {
    createOutputChannel: name => {
      const channel = { clear() {}, appendLine() {}, show() {}, dispose() {} };
      channels[name] = channel;
      return channel;
    },
  },
  commands: {
    registerCommand: (name, callback) => {
      registeredCommands[name] = callback;
      return { dispose() {} };
    },
  },
};

class CapturingLanguageClient {
  constructor(id, name, serverOptions, clientOptions) {
    Object.assign(registrations, { id, name, serverOptions, clientOptions, client: this });
  }
  async start() { registrations.started = true; }
  async setTrace() {}
  async stop() { registrations.stopped = true; }
}

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscodeMock;
  if (request === 'vscode-languageclient/node') {
    return {
      LanguageClient: CapturingLanguageClient,
      RevealOutputChannelOn: { Error: 3 },
      Trace: { Off: 0, Messages: 1, Verbose: 3 },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let extension;
try {
  extension = require('../extension.js');
} finally {
  Module._load = originalLoad;
}

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function createMessageReader(child) {
  let buffer = Buffer.alloc(0);
  const messages = [];
  const waiters = [];
  let closed;

  function rejectWaiters(error) {
    closed = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  }

  function dispatch() {
    for (let index = waiters.length - 1; index >= 0; index--) {
      const messageIndex = messages.findIndex(waiters[index].predicate);
      if (messageIndex < 0) continue;
      const [message] = messages.splice(messageIndex, 1);
      waiters.splice(index, 1)[0].resolve(message);
    }
  }

  child.stdout.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const separator = buffer.indexOf(Buffer.from('\r\n\r\n'));
      if (separator < 0) break;
      const header = buffer.slice(0, separator).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(separator + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = separator + 4;
      if (buffer.length < start + length) break;
      messages.push(JSON.parse(buffer.slice(start, start + length).toString('utf8')));
      buffer = buffer.slice(start + length);
    }
    dispatch();
  });
  child.on('error', rejectWaiters);
  child.on('close', (code, signal) => rejectWaiters(
    new Error(`Flow LSP closed (${code ?? 'null'}${signal ? `, ${signal}` : ''})`),
  ));

  return (predicate, timeout = 10000) => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    if (closed) return Promise.reject(closed);
    return new Promise((resolve, reject) => {
      const waiter = { predicate };
      waiter.resolve = value => { clearTimeout(waiter.timer); resolve(value); };
      waiter.reject = error => { clearTimeout(waiter.timer); reject(error); };
      waiter.timer = setTimeout(() => {
        const position = waiters.indexOf(waiter);
        if (position >= 0) waiters.splice(position, 1);
        reject(new Error('timed out waiting for Flow LSP response'));
      }, timeout);
      waiters.push(waiter);
    });
  };
}

function createProtocolClient(child) {
  const nextMessage = createMessageReader(child);
  let id = 0;
  return {
    nextMessage,
    notify(method, params) {
      child.stdin.write(frame({ jsonrpc: '2.0', method, params }));
    },
    async request(method, params) {
      const requestId = ++id;
      const response = nextMessage(message => message.id === requestId);
      child.stdin.write(frame({ jsonrpc: '2.0', id: requestId, method, params }));
      const message = await response;
      assert.equal(message.error, undefined, `${method} failed: ${message.error?.message}`);
      assert.ok(Object.hasOwn(message, 'result'), `${method} returned no result field`);
      return message.result;
    },
  };
}

test('VS Code adapter launches real Flow LSP and forwards editor feature requests', {
  skip: !CORE,
  timeout: 60000,
}, async t => {
  for (const key of Object.keys(settings)) delete settings[key];
  for (const key of Object.keys(registrations)) delete registrations[key];
  for (const key of Object.keys(channels)) delete channels[key];
  for (const key of Object.keys(registeredCommands)) delete registeredCommands[key];
  Object.assign(settings, { nflowCommand: CORE, 'languageServer.command': '', 'languageServer.args': [] });

  const context = { extensionPath: EXTENSION_PATH, subscriptions: [] };
  let managed;
  let protocol;
  t.after(async () => {
    if (t.passed === false && managed?.diagnostics()) t.diagnostic(managed.diagnostics());
    if (protocol && managed && !managed.closeResult) {
      try {
        await protocol.request('shutdown', {});
        protocol.notify('exit', {});
        managed.child.stdin.end();
      } catch {}
    }
    if (managed && !await managed.stop()) t.diagnostic('Flow LSP process tree did not close during cleanup.');
    await extension.deactivate();
    for (const key of Object.keys(settings)) delete settings[key];
  });

  await extension.activate(context);
  assert.equal(registrations.started, true);
  assert.equal(registrations.serverOptions.command, process.execPath);
  assert.deepEqual(registrations.serverOptions.args, [LAUNCHER]);
  assert.equal(registrations.serverOptions.options.env.NFLOW_BIN, CORE);
  assert.deepEqual(registrations.clientOptions.documentSelector, [
    { scheme: 'file', language: 'nexss-flow' },
  ]);

  const { command, args, options } = registrations.serverOptions;
  managed = spawnCaptured(command, args, { env: options.env });
  protocol = createProtocolClient(managed.child);

  const initializeResult = await protocol.request('initialize', {
    processId: process.pid,
    rootUri: 'file:///tmp',
    workspaceFolders: [{ uri: 'file:///tmp', name: 'tmp' }],
    capabilities: {
      textDocument: {
        completion: { completionItem: { snippetSupport: true } },
        hover: {},
        definition: {},
        references: {},
        rename: {},
        documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        foldingRange: {},
        semanticTokens: {
          requests: { full: true, range: true },
          tokenTypes: ['namespace', 'type', 'class', 'enum', 'interface', 'struct', 'typeParameter', 'parameter', 'variable', 'property', 'enumMember', 'event', 'function', 'method', 'macro', 'keyword', 'modifier', 'comment', 'string', 'number', 'regexp', 'operator', 'decorator'],
          tokenModifiers: ['declaration', 'definition', 'readonly', 'static', 'deprecated', 'abstract', 'async', 'modification', 'documentation', 'defaultLibrary'],
          formats: ['relative'],
        },
        codeAction: { codeActionLiteralSupport: { codeActionKind: { valueSet: ['quickfix', 'refactor'] } } },
      },
      workspace: { symbol: {} },
    },
  });

  const capabilities = initializeResult.capabilities;
  const requiredProviders = [
    'completionProvider', 'hoverProvider', 'definitionProvider', 'referencesProvider',
    'renameProvider', 'documentSymbolProvider', 'workspaceSymbolProvider',
    'foldingRangeProvider', 'semanticTokensProvider', 'codeActionProvider',
  ];
  for (const provider of requiredProviders) {
    assert.ok(capabilities[provider], `Flow LSP did not advertise ${provider}`);
  }
  protocol.notify('initialized', {});

  const uri = 'file:///tmp/vscode-adapter-smoke.nflow';
  const text = [
    '@schema Request {',
    '  Name string `json:"name" validate:"required"`',
    '}',
    '',
    '@pipeline editor_smoke',
    '  runtime.const @{ value: "ok" }',
    '@end',
    '',
  ].join('\n');
  protocol.notify('textDocument/didOpen', {
    textDocument: { uri, languageId: 'nexss-flow', version: 1, text },
  });
  const diagnostics = await protocol.nextMessage(message =>
    message.method === 'textDocument/publishDiagnostics' && message.params.uri === uri);
  assert.ok(Array.isArray(diagnostics.params.diagnostics));

  const doc = { uri };
  const point = (line, character) => ({ line, character });
  const requests = [
    ['textDocument/completion', { textDocument: doc, position: point(5, 13) }],
    ['textDocument/hover', { textDocument: doc, position: point(0, 10) }],
    ['textDocument/definition', { textDocument: doc, position: point(0, 10) }],
    ['textDocument/references', { textDocument: doc, position: point(0, 10), context: { includeDeclaration: true } }],
    ['textDocument/rename', { textDocument: doc, position: point(0, 10), newName: 'RenamedRequest' }],
    ['textDocument/documentSymbol', { textDocument: doc }],
    ['workspace/symbol', { query: 'editor_smoke' }],
    ['textDocument/foldingRange', { textDocument: doc }],
    ['textDocument/semanticTokens/full', { textDocument: doc }],
    ['textDocument/codeAction', {
      textDocument: doc,
      range: { start: point(0, 0), end: point(6, 5) },
      context: { diagnostics: diagnostics.params.diagnostics, only: ['quickfix'] },
    }],
  ];
  const results = {};
  for (const [method, params] of requests) results[method] = await protocol.request(method, params);

  assert.ok(results['textDocument/completion'] === null
    || Array.isArray(results['textDocument/completion'])
    || Array.isArray(results['textDocument/completion'].items));
  for (const method of ['textDocument/documentSymbol', 'workspace/symbol', 'textDocument/foldingRange', 'textDocument/codeAction']) {
    assert.ok(Array.isArray(results[method]), `${method} did not return an array`);
  }
  assert.ok(results['textDocument/semanticTokens/full'] === null
    || Array.isArray(results['textDocument/semanticTokens/full'].data));

  await protocol.request('shutdown', {});
  protocol.notify('exit', {});
  managed.child.stdin.end();
  const exit = await managed.waitForClose(5000, 'VS Code adapter Flow LSP smoke test');
  assert.equal(exit.code, 0, managed.diagnostics());
});
