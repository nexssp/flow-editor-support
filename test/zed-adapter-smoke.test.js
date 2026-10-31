'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnCaptured } = require('./helpers/process-tree');
const CORE = process.env.NFLOW_BIN || '';
const LAUNCHER = path.resolve(__dirname, '../zed/lsp/nflow-lsp.js');

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function createProtocolClient(child) {
  let buffer = Buffer.alloc(0);
  const messages = [];
  const waiters = [];
  let closed;

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
      const header = buffer.subarray(0, separator).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(separator + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = separator + 4;
      if (buffer.length < start + length) break;
      messages.push(JSON.parse(buffer.subarray(start, start + length).toString('utf8')));
      buffer = buffer.subarray(start + length);
    }
    dispatch();
  });
  child.on('error', error => { closed = error; dispatch(); });
  child.on('close', (code, signal) => {
    closed = new Error(`Zed adapter closed (${code ?? 'null'}${signal ? `, ${signal}` : ''})`);
    dispatch();
  });

  function next(predicate, timeout = 10000) {
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
        reject(new Error('timed out waiting for Zed adapter LSP response'));
      }, timeout);
      waiters.push(waiter);
    });
  }

  let id = 0;
  return {
    next,
    notify(method, params) {
      child.stdin.write(frame({ jsonrpc: '2.0', method, params }));
    },
    async request(method, params) {
      const requestId = ++id;
      const response = next(message => message.id === requestId);
      child.stdin.write(frame({ jsonrpc: '2.0', id: requestId, method, params }));
      const message = await response;
      assert.equal(message.error, undefined, `${method} failed: ${message.error?.message}`);
      assert.ok(Object.hasOwn(message, 'result'), `${method} returned no result field`);
      return message.result;
    },
  };
}

test('Zed adapter launches the real Flow LSP and serves a Flow document', {
  skip: !CORE,
  timeout: 60000,
}, async t => {
  let managed;
  let protocol;
  t.after(async () => {
    if (managed && protocol && !managed.closeResult) {
      try {
        await protocol.request('shutdown', {});
        protocol.notify('exit', {});
        managed.child.stdin.end();
      } catch {}
    }
    if (managed && !await managed.stop()) t.diagnostic('Flow LSP process tree did not close during cleanup.');
  });

  managed = spawnCaptured(process.execPath, [LAUNCHER], {
    env: { ...process.env, NFLOW_BIN: CORE },
  });
  protocol = createProtocolClient(managed.child);
  const initialized = await protocol.request('initialize', {
    processId: process.pid,
    rootUri: 'file:///tmp',
    workspaceFolders: [{ uri: 'file:///tmp', name: 'tmp' }],
    capabilities: { textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } } },
  });
  assert.ok(initialized.capabilities.documentSymbolProvider, 'Flow LSP did not advertise document symbols');
  protocol.notify('initialized', {});

  const uri = 'file:///tmp/zed-adapter-smoke.nflow';
  const text = [
    '@schema Request {',
    '  Name string `json:"name" validate:"required"`',
    '}',
    '',
    '@pipeline zed_adapter_smoke',
    '  runtime.const @{ value: "ok" }',
    '@end',
    '',
  ].join('\n');
  protocol.notify('textDocument/didOpen', {
    textDocument: { uri, languageId: 'Nexss Flow', version: 1, text },
  });
  const diagnostics = await protocol.next(message =>
    message.method === 'textDocument/publishDiagnostics' && message.params.uri === uri);
  assert.ok(Array.isArray(diagnostics.params.diagnostics));

  const symbols = await protocol.request('textDocument/documentSymbol', { textDocument: { uri } });
  assert.ok(Array.isArray(symbols), 'document-symbol request did not return an array');
  assert.ok(symbols.length > 0, 'Flow LSP returned no symbols for the opened document');

  await protocol.request('shutdown', {});
  protocol.notify('exit', {});
  managed.child.stdin.end();
  const exit = await managed.waitForClose(5000, 'Zed adapter Flow LSP smoke test');
  assert.equal(exit.code, 0, managed.diagnostics());
});
