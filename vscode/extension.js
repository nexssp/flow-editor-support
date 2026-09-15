const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');

let server;
let nextId = 1;
let pending = new Map();
let buffer = Buffer.alloc(0);

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    server.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
  });
}
function consume() {
  while (true) {
    const separator = buffer.indexOf(Buffer.from('\r\n\r\n'));
    if (separator < 0) return;
    const header = buffer.slice(0, separator).toString('ascii');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.slice(separator + 4); continue; }
    const length = Number(match[1]);
    const start = separator + 4;
    if (buffer.length < start + length) return;
    const message = JSON.parse(buffer.slice(start, start + length).toString('utf8'));
    buffer = buffer.slice(start + length);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  }
}
function activate(context) {
  const configured = (vscode.workspace.getConfiguration('nexssFlow').get('languageServer.command') || '').trim();
  const parts = configured ? configured.split(/\s+/) : [];
  const command = parts[0] || process.execPath;
  const args = parts.length > 0 ? parts.slice(1) : [path.join(context.extensionPath, 'lsp', 'flow-language-server.js')];
  server = cp.spawn(command, args, { cwd: context.extensionPath, stdio: ['pipe', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { buffer = Buffer.concat([buffer, chunk]); consume(); });
  server.stderr.on('data', chunk => console.error(`[nexss-flow-lsp] ${chunk}`));
  send('initialize', { processId: process.pid, rootUri: vscode.workspace.workspaceFolders?.[0]?.uri.toString() || null, capabilities: {} }).catch(console.error);

  const provider = vscode.languages.registerCompletionItemProvider('nexss-flow', {
    async provideCompletionItems(document, position) {
      try {
        const result = await send('textDocument/completion', {
          textDocument: { uri: document.uri.toString() },
          position: { line: position.line, character: position.character }
        });
        return (result?.items || []).map(item => {
          const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Keyword);
          completion.detail = item.detail;
          completion.insertText = item.textEdit?.newText || item.insertText || item.label;
          return completion;
        });
      } catch (_) { return []; }
    }
  }, '@', ':', '.', ' ', '-', '|', '&', '?', '{');
  context.subscriptions.push(provider);
  const hover = vscode.languages.registerHoverProvider('nexss-flow', {
    async provideHover(document, position) {
      try {
        const result = await send('textDocument/hover', {
          textDocument: { uri: document.uri.toString() },
          position: { line: position.line, character: position.character }
        });
        if (!result?.contents) return undefined;
        const value = typeof result.contents === 'string' ? result.contents : result.contents.value;
        return new vscode.Hover(new vscode.MarkdownString(value));
      } catch (_) { return undefined; }
    }
  });
  context.subscriptions.push(hover);
}
async function deactivate() {
  if (!server) return undefined;
  try { await send('shutdown', {}); } catch (_) { /* best effort */ }
  server.kill();
  server = undefined;
}
module.exports = { activate, deactivate };
