'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnCaptured } = require('../../test/helpers/process-tree');

const CORE = process.env.NFLOW_BIN || '';
const LAUNCHER = path.resolve(__dirname, '../../lsp/nflow-lsp.js');
const TEMPLATE_INPUT = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/template-render-input.nflow'), 'utf8');
const TEMPLATE_EXPECTED = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/template-render-expected.nflow'), 'utf8');

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
  child.stdout.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const separator = buffer.indexOf(Buffer.from('\r\n\r\n'));
      if (separator < 0) break;
      const header = buffer.slice(0, separator).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { buffer = buffer.slice(separator + 4); continue; }
      const length = Number(match[1]);
      const start = separator + 4;
      if (buffer.length < start + length) break;
      messages.push(JSON.parse(buffer.slice(start, start + length).toString('utf8')));
      buffer = buffer.slice(start + length);
    }
    for (let index = waiters.length - 1; index >= 0; index--) {
      const messageIndex = messages.findIndex(waiters[index].predicate);
      if (messageIndex >= 0) {
        const [message] = messages.splice(messageIndex, 1);
        waiters.splice(index, 1)[0].resolve(message);
      }
    }
  });
  child.on('error', rejectWaiters);
  child.on('close', (code, signal) => rejectWaiters(new Error(`Flow LSP closed (${code ?? 'null'}${signal ? `, ${signal}` : ''})`)));
  return (predicate, timeout = 10000) => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    if (closed) return Promise.reject(closed);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject };
      waiter.timer = setTimeout(() => {
        const position = waiters.indexOf(waiter);
        if (position >= 0) waiters.splice(position, 1);
        reject(new Error('timed out waiting for native Flow LSP message'));
      }, timeout);
      const finish = fn => value => { clearTimeout(waiter.timer); fn(value); };
      waiter.resolve = finish(resolve);
      waiter.reject = finish(reject);
      waiters.push(waiter);
    });
  };
}

function notify(child, method, params) {
  child.stdin.write(frame({ jsonrpc: '2.0', method, params }));
}

function request(child, id, method, params) {
  child.stdin.write(frame({ jsonrpc: '2.0', id, method, params }));
}

test('native Flow LSP publishes diagnostics and formats valid source', { skip: !CORE, timeout: 60000 }, async t => {
  const managed = spawnCaptured(process.execPath, [LAUNCHER], {
    env: { ...process.env, NFLOW_BIN: CORE },
  });
  const child = managed.child;
  const nextMessage = createMessageReader(child);
  t.after(async () => {
    if (t.passed === false && managed.diagnostics()) t.diagnostic(managed.diagnostics());
    if (!await managed.stop()) t.diagnostic('Flow LSP process tree did not close before the cleanup deadline.');
  });

  const uri = 'file:///tmp/native-flow-diagnostic.nflow';
  const invalid = '@pipeline broken\n  (\n@end\n';
  const valid = '@pipeline work:timeout=2s:retry=3\n  runtime.const:retry=2\n@end\n';

  request(child, 1, 'initialize', {
    processId: process.pid,
    rootUri: 'file:///tmp',
    capabilities: {},
  });
  const initialized = await nextMessage(message => message.id === 1);
  assert.equal(initialized.error, undefined, initialized.error?.message);
  assert.equal(typeof initialized.result.serverInfo.version, 'string', 'Flow LSP did not report its version');
  assert.equal(initialized.result.capabilities.documentFormattingProvider, true);
  assert.ok(initialized.result.capabilities.completionProvider);
  assert.equal(initialized.result.capabilities.hoverProvider, true);
  notify(child, 'initialized', {});

  notify(child, 'textDocument/didOpen', {
    textDocument: { uri, languageId: 'nflow', version: 1, text: invalid },
  });
  const initialDiagnostics = await nextMessage(message =>
    message.method === 'textDocument/publishDiagnostics' && message.params.uri === uri && message.params.version === 1);
  assert.ok(initialDiagnostics.params.diagnostics.length > 0);
  assert.equal(initialDiagnostics.params.diagnostics[0].source, 'nflow');
  assert.equal(initialDiagnostics.params.diagnostics[0].severity, 1);

  request(child, 2, 'textDocument/formatting', {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  const invalidFormat = await nextMessage(message => message.id === 2);
  assert.equal(invalidFormat.error.code, -32603);
  assert.equal(invalidFormat.result, undefined);
  assert.ok(invalidFormat.error.message);
  assert.equal(invalid, '@pipeline broken\n  (\n@end\n');

  notify(child, 'textDocument/didChange', {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: valid }],
  });
  const clearedDiagnostics = await nextMessage(message =>
    message.method === 'textDocument/publishDiagnostics' && message.params.uri === uri && message.params.version === 2);
  assert.deepEqual(clearedDiagnostics.params.diagnostics, []);

  request(child, 3, 'textDocument/formatting', {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  const formatted = await nextMessage(message => message.id === 3);
  assert.equal(formatted.error, undefined, formatted.error?.message);
  assert.equal(formatted.result.length, 1);
  assert.equal(formatted.result[0].newText,
    '@pipeline work\n  :timeout=2s\n  :retry=3\n  runtime.const :retry=2\n@end\n');

  notify(child, 'textDocument/didChange', {
    textDocument: { uri, version: 3 },
    contentChanges: [{ text: TEMPLATE_INPUT }],
  });
  const templateDiagnostics = await nextMessage(message =>
    message.method === 'textDocument/publishDiagnostics' && message.params.uri === uri && message.params.version === 3);
  assert.deepEqual(templateDiagnostics.params.diagnostics, []);

  request(child, 5, 'textDocument/formatting', {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  const templateFormatted = await nextMessage(message => message.id === 5);
  assert.equal(templateFormatted.error, undefined, templateFormatted.error?.message);
  assert.equal(templateFormatted.result.length, 1);
  assert.equal(templateFormatted.result[0].newText, TEMPLATE_EXPECTED);

  request(child, 6, 'shutdown', {});
  await nextMessage(message => message.id === 6);
  notify(child, 'exit', {});
  child.stdin.end();
  const exit = await managed.waitForClose(3000, 'Flow LSP launcher');
  assert.equal(exit.code, 0, managed.diagnostics());
});
