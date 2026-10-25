'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CORE = process.env.FLOW_NFLOW_BIN || '';
const source = [
  '@nflow_version ">=0.43.0"',
  '@description "Formatter integration"',
  '@require ./local/helpers as helpers {',
  '  prefix: "DEMO"',
  '}',
  '@pipeline editor:timeout=2s:retry=3',
  '  runtime.const:retry=1 @{ value: "ok" }',
  '@end',
  '@pipeline spaced :timeout=3s :retry=4',
  '  runtime.call :timeout=1s :retry=2',
  '@end',
  '@assert: result.ok == true',
  '',
].join('\n');
const adapters = [
  'fmt/index.js',
  'vscode/fmt/index.js',
  'zed/fmt/index.js',
  'zed-legacy-0.230.2/fmt/index.js',
  'claude/fmt/index.js',
  'notepadpp/fmt/index.js',
  'jetbrains/fmt/index.js',
];
const cliWrappers = [
  'fmt/cli.js',
  'claude/fmt/cli.js',
  'notepadpp/fmt/cli.js',
  'jetbrains/fmt/cli.js',
];
const languageServers = [
  ['shared LSP', 'lsp/flow-language-server.js'],
  ['VS Code LSP', 'vscode/lsp/flow-language-server.js'],
  ['Zed current LSP', 'zed/lsp/flow-language-server.js'],
  ['Zed legacy LSP', 'zed-legacy-0.230.2/lsp/flow-language-server.js'],
  ['Claude Code LSP', 'claude/lsp/flow-language-server.js'],
];

function runCore(args, input = '') {
  const result = spawnSync(CORE, ['fmt', ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function messageReader(child) {
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
    for (let index = waiters.length - 1; index >= 0; index--) {
      const messageIndex = messages.findIndex(waiters[index].predicate);
      if (messageIndex >= 0) {
        const [message] = messages.splice(messageIndex, 1);
        waiters.splice(index, 1)[0].resolve(message);
      }
    }
  });
  child.on('error', error => {
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });
  return predicate => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject };
      waiter.timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('timed out waiting for bundled Flow LSP'));
      }, 10000);
      const finish = fn => value => { clearTimeout(waiter.timer); fn(value); };
      waiter.resolve = finish(resolve);
      waiter.reject = finish(reject);
      waiters.push(waiter);
    });
  };
}

async function formatThroughLsp(relativePath, expected) {
  const serverPath = path.join(ROOT, relativePath);
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, NFLOW_BIN: CORE },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const nextMessage = messageReader(child);
  const uri = `file:///${encodeURIComponent(relativePath)}.nflow`;
  try {
    child.stdin.write(frame({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { initializationOptions: { nflowCommand: CORE } },
    }));
    const initialized = await nextMessage(message => message.id === 1);
    assert.equal(initialized.error, undefined, `${relativePath} initialization failed`);
    child.stdin.write(frame({
      jsonrpc: '2.0', method: 'textDocument/didOpen',
      params: { textDocument: { uri, languageId: 'nexss-flow', version: 1, text: source } },
    }));
    child.stdin.write(frame({
      jsonrpc: '2.0', id: 2, method: 'textDocument/formatting',
      params: { textDocument: { uri } },
    }));
    const response = await nextMessage(message => message.id === 2);
    assert.equal(response.error, undefined, response.error?.message);
    assert.equal(response.result.length, 1);
    assert.equal(response.result[0].newText, expected);
    child.stdin.write(frame({ jsonrpc: '2.0', id: 3, method: 'shutdown', params: {} }));
    await nextMessage(message => message.id === 3);
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'exit' }));
  } finally {
    child.kill();
  }
}

test('all editor formatter adapters match the actual Flow core formatter', { skip: !CORE }, () => {
  const expected = runCore(['--stdin'], source);
  for (const relativePath of adapters) {
    const { format } = require(path.join(ROOT, relativePath));
    assert.equal(format(source, { command: CORE }), expected, relativePath);
  }
});

test('all editor CLI wrappers pass stdin and atomic file writes to nflow fmt', { skip: !CORE }, t => {
  const expected = runCore(['--stdin'], source);
  const env = { ...process.env, NFLOW_BIN: CORE };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flow fmt real core '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [index, relativePath] of cliWrappers.entries()) {
    const script = path.join(ROOT, relativePath);
    const stdin = spawnSync(process.execPath, [script, '--stdin'], {
      input: source, encoding: 'utf8', env,
    });
    assert.equal(stdin.status, 0, `${relativePath}: ${stdin.stderr}`);
    assert.equal(stdin.stdout, expected, relativePath);

    const file = path.join(directory, `sample ${index}.nflow`);
    fs.writeFileSync(file, source);
    const write = spawnSync(process.execPath, [script, '--write', file], { encoding: 'utf8', env });
    assert.equal(write.status, 0, `${relativePath}: ${write.stderr}`);
    assert.equal(fs.readFileSync(file, 'utf8'), expected, relativePath);
    const check = spawnSync(process.execPath, [script, '--check', file], { encoding: 'utf8', env });
    assert.equal(check.status, 0, `${relativePath}: ${check.stderr}`);
  }
});

test('JetBrains External Tool command formats a named file with the real Flow core', { skip: !CORE }, t => {
  const expected = runCore(['--stdin'], source);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jetbrains flow formatter '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'sample file.nflow');
  fs.writeFileSync(file, source);
  const write = spawnSync(CORE, ['fmt', '--write', file], { encoding: 'utf8' });
  assert.equal(write.status, 0, write.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), expected);
});

test('every editor LSP bridge returns the actual Flow core formatting unchanged', { skip: !CORE }, async t => {
  const expected = runCore(['--stdin'], source);
  for (const [name, relativePath] of languageServers) {
    await t.test(name, async () => {
      await formatThroughLsp(relativePath, expected);
    });
  }
});
