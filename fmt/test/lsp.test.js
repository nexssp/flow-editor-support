const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

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
  return (predicate) => {
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

test('LSP serves current snippets and formats with UTF-16 ranges', async () => {
  const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  const nextMessage = collectMessages(child);
  const text = '😀->noop';
  const uri = 'file:///flow.nflow';
  const blockText = 'parallel {\nprofile:const @{ value:"x" },\n}\n';
  const blockUri = 'file:///parallel.nflow';
  try {
    child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri, languageId: 'nexss-flow', version: 1, text },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/formatting', params: {
      textDocument: { uri }, options: { tabSize: 2, insertSpaces: true },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 3, method: 'textDocument/completion', params: {
      textDocument: { uri }, position: { line: 1, character: 0 },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri: blockUri, languageId: 'nexss-flow', version: 1, text: blockText },
    } }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 4, method: 'textDocument/formatting', params: {
      textDocument: { uri: blockUri }, options: { tabSize: 4, insertSpaces: false },
    } }));

    const initialized = await nextMessage(message => message.id === 1);
    assert.equal(initialized.result.capabilities.documentFormattingProvider, true);
    const formatting = await nextMessage(message => message.id === 2);
    assert.equal(formatting.result[0].newText, '😀 -> noop\n');
    assert.equal(formatting.result[0].range.end.character, text.length);
    const completion = await nextMessage(message => message.id === 3);
    const labels = completion.result.items.map(item => item.label);
    assert.ok(labels.includes('flow-args'));
    assert.ok(labels.includes('flow-match'));
    assert.ok(labels.includes('flow-assert-expression'));
    assert.ok(labels.includes('flow-assert-inline'));
    assert.ok(labels.includes('flow-assert-call'));

    const canonicalBlock = await nextMessage(message => message.id === 4);
    assert.equal(canonicalBlock.result[0].newText, 'parallel {\n  profile: const @{ value: "x" },\n}\n');

    child.stdin.write(frame({ jsonrpc: '2.0', id: 5, method: 'shutdown', params: {} }));
    await nextMessage(message => message.id === 5);
    child.stdin.end();
  } finally {
    if (!child.killed) child.kill();
  }
});
