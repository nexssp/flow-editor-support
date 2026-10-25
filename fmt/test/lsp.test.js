'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { createNflowMock, readCalls } = require('./helpers.js');

const serverPath = path.join(__dirname, '..', '..', 'lsp', 'flow-language-server.js');
function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function collectMessages(child) {
  let buffer = Buffer.alloc(0);
  const messages = [];
  const waiters = [];
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
    for (let i = waiters.length - 1; i >= 0; i--) {
      const index = messages.findIndex(waiters[i].predicate);
      if (index >= 0) {
        const [message] = messages.splice(index, 1);
        waiters.splice(i, 1)[0].resolve(message);
      }
    }
  });
  return predicate => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject };
      waiters.push(waiter);
      const timer = setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error('timed out waiting for language-server response'));
      }, 5000);
      waiter.resolve = value => { clearTimeout(timer); resolve(value); };
    });
  };
}

function startServer(mock) {
  const child = spawn(process.execPath, [serverPath], { env: mock.env, stdio: ['pipe', 'pipe', 'pipe'] });
  return { child, nextMessage: collectMessages(child) };
}

test('LSP delegates formatting to nflow and preserves multiline output verbatim', async t => {
  const emoji = '😀->noop';
  const block = '@pipeline work:timeout=2s:retry=3\n  action.node:retry=2\n@end\n';
  const expectedEmoji = '😀 -> noop\n';
  const expectedBlock = '@pipeline work\n  :timeout=2s\n  :retry=3\n\n  action.node :retry=2\n@end\n';
  const mock = createNflowMock(t, { outputs: { [emoji]: expectedEmoji, [block]: expectedBlock } });
  const { child, nextMessage } = startServer(mock);
  const uri = 'file:///flow.nflow';
  const blockUri = 'file:///pipeline.nflow';
  try {
    child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      initializationOptions: { nflowCommand: mock.executable },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri, languageId: 'nexss-flow', version: 1, text: emoji },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/formatting', params: { textDocument: { uri } } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 3, method: 'textDocument/completion', params: {
      textDocument: { uri }, position: { line: 1, character: 0 },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri: blockUri, languageId: 'nexss-flow', version: 1, text: block },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 4, method: 'textDocument/formatting', params: { textDocument: { uri: blockUri } } }));

    const initialized = await nextMessage(message => message.id === 1);
    assert.equal(initialized.result.capabilities.documentFormattingProvider, true);
    const formatting = await nextMessage(message => message.id === 2);
    assert.equal(formatting.result[0].newText, expectedEmoji);
    assert.equal(formatting.result[0].range.end.character, emoji.length);
    const completion = await nextMessage(message => message.id === 3);
    const labels = completion.result.items.map(item => item.label);
    assert.ok(labels.includes('flow-args'));
    assert.ok(labels.includes('flow-match'));
    assert.ok(labels.includes('flow-assert-expression'));
    assert.ok(labels.includes('flow-assert-inline'));
    assert.ok(labels.includes('flow-assert-call'));
    assert.match(completion.result.items.find(item => item.label === 'flow-pipeline').textEdit.newText, /  :timeout=10s/);

    const multiline = await nextMessage(message => message.id === 4);
    assert.equal(multiline.result[0].newText, expectedBlock);
    assert.deepEqual(readCalls(mock), [
      { args: ['fmt', '--stdin'], input: emoji },
      { args: ['fmt', '--stdin'], input: block },
    ]);

    child.stdin.write(frame({ jsonrpc: '2.0', id: 5, method: 'shutdown', params: {} }));
    await nextMessage(message => message.id === 5);
    child.stdin.end();
  } finally {
    if (!child.killed) child.kill();
  }
});

test('LSP reports formatter failures as JSON-RPC errors rather than hanging', async t => {
  const mock = createNflowMock(t, { exitCode: 2, stderr: 'invalid Flow syntax' });
  const { child, nextMessage } = startServer(mock);
  const uri = 'file:///broken.nflow';
  try {
    child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri, languageId: 'nexss-flow', version: 1, text: 'broken' },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/formatting', params: { textDocument: { uri } } }));
    await nextMessage(message => message.id === 1);
    const response = await nextMessage(message => message.id === 2);
    assert.equal(response.error.code, -32603);
    assert.match(response.error.message, /invalid Flow syntax/);
  } finally {
    child.kill();
  }
});

test('LSP publishes a source diagnostic at the compiler line and UTF-16 column', async t => {
  const mock = createNflowMock(t, { exitCode: 1, stderr: '<stdin>:2:5: unexpected token' });
  const { child, nextMessage } = startServer(mock);
  const uri = 'file:///positioned-error.nflow';
  const text = '# ok\nfoo 😀\n';
  try {
    child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri, languageId: 'nexss-flow', version: 1, text },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/formatting', params: {
      textDocument: { uri },
    } }));
    await nextMessage(message => message.id === 1);
    const response = await nextMessage(message => message.id === 2);
    const notification = await nextMessage(message => message.method === 'textDocument/publishDiagnostics');
    assert.equal(response.error.code, -32603);
    assert.equal(notification.params.uri, uri);
    assert.deepEqual(notification.params.diagnostics[0].range, {
      start: { line: 1, character: 4 }, end: { line: 1, character: 5 },
    });
    assert.equal(notification.params.diagnostics[0].message, 'unexpected token');
  } finally {
    child.kill();
  }
});

test('LSP formats through the real core command when configured', { skip: !process.env.FLOW_NFLOW_BIN }, async t => {
  const { child, nextMessage } = startServer({ env: { ...process.env, NFLOW_BIN: process.env.FLOW_NFLOW_BIN } });
  const uri = 'file:///real-core.nflow';
  const input = '@pipeline work:timeout=2s:retry=3\n  runtime.const:retry=2\n@end\n';
  try {
    child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      initializationOptions: { nflowCommand: process.env.FLOW_NFLOW_BIN },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri, languageId: 'nexss-flow', version: 1, text: input },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/formatting', params: {
      textDocument: { uri },
    } }));
    await nextMessage(message => message.id === 1);
    const response = await nextMessage(message => message.id === 2);
    assert.equal(response.error, undefined);
    assert.equal(response.result[0].newText,
      '@pipeline work\n  :timeout=2s\n  :retry=3\n  runtime.const :retry=2\n@end\n');

    const brokenUri = 'file:///real-core-broken.nflow';
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri: brokenUri, languageId: 'nexss-flow', version: 1, text: '# ok\nfoo 😀\n' },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 3, method: 'textDocument/formatting', params: {
      textDocument: { uri: brokenUri },
    } }));
    const errorResponse = await nextMessage(message => message.id === 3);
    const diagnostics = await nextMessage(message => message.method === 'textDocument/publishDiagnostics' && message.params.uri === brokenUri);
    assert.match(errorResponse.error.message, /<stdin>:2:5:/);
    assert.deepEqual(diagnostics.params.diagnostics[0].range, {
      start: { line: 1, character: 4 }, end: { line: 1, character: 5 },
    });
    assert.equal(diagnostics.params.diagnostics[0].source, 'nflow fmt');
  } finally {
    child.kill();
  }
});
