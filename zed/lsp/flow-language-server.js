#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const formatterPath = [
  path.join(__dirname, '..', 'fmt', 'index.js'),
  path.join(__dirname, '..', '..', 'fmt', 'index.js'),
].find(file => fs.existsSync(file));
if (!formatterPath) throw new Error('flowfmt formatter module not found');
const { format } = require(formatterPath);

// Minimal LSP stub for editor integration. It is intentionally dependency-free.
// It provides initialize, shutdown, textDocument/completion, and hover. A future
// implementation can replace the completion/hover tables with kernel registry data.

const snippets = [
  ['flow-pipe', 'source.node\n-> target.node', 'Sequential pipeline'],
  ['flow-parallel', '( first.node & second.node )', 'Parallel fan-out'],
  ['flow-fallback', '( primary.node || fallback.node )', 'Fallback chain'],
  ['flow-if', 'gate ? target.node', 'Conditional node'],
  ['flow-projection', '{ field: .input }', 'Inline projection'],
  ['flow-loop', 'loop( body.node ) until( condition )', 'Bounded loop'],
  ['flow-node', 'namespace.node:timeout=10s:retry=2', 'Configured action node'],
  ['flow-pipeline', '@pipeline name\n  source.node\n@end', 'Named pipeline'],
];
let buffer = Buffer.alloc(0);
let shutdown = false;
const documents = new Map();

function send(id, result, error) {
  const payload = JSON.stringify(error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`);
}
function completionItems(position = { line: 0, character: 0 }) {
  return snippets.map(([label, insertText, detail]) => ({
    label, kind: 15, detail, insertTextFormat: 2,
    textEdit: { newText: insertText, range: { start: position, end: position } }
  }));
}
function endPosition(text) {
  const lines = text.split(/\r?\n/);
  return { line: Math.max(0, lines.length - 1), character: [...(lines[lines.length - 1] || '')].length };
}
function documentText(uri) { return documents.get(uri) || ''; }
function extractText(params) {
  if (params.textDocument && typeof params.textDocument.text === 'string') return params.textDocument.text;
  const changes = params.contentChanges || [];
  return changes.length && typeof changes[changes.length - 1].text === 'string' ? changes[changes.length - 1].text : '';
}
function handle(msg) {
  const { id, method, params = {} } = msg;
  if (method === 'initialize') return send(id, { capabilities: {
    textDocumentSync: 1,
    documentFormattingProvider: true,
    completionProvider: { triggerCharacters: ['@', ':', '.', ' ', '-', '|', '&', '?', '{'] },
    hoverProvider: true,
    definitionProvider: false,
  }, serverInfo: { name: 'nexss-flow-lsp-stub', version: '0.1.0' } });
  if (method === 'shutdown') { shutdown = true; return send(id, null); }
  if (method === 'exit') { process.exit(shutdown ? 0 : 1); }
  if (method === 'textDocument/completion') return send(id, { isIncomplete: false, items: completionItems(params.position || { line: 0, character: 0 }) });
  if (method === 'textDocument/hover') return send(id, { contents: { kind: 'markdown', value: '**Nexss Flow** node or DSL construct.\n\nThe stub is ready to be replaced by registry-aware analysis.' } });
  if (method === 'textDocument/didOpen' || method === 'textDocument/didChange') {
    const uri = params.textDocument && params.textDocument.uri;
    if (uri) documents.set(uri, extractText(params));
    return;
  }
  if (method === 'textDocument/didClose') {
    const uri = params.textDocument && params.textDocument.uri;
    if (uri) documents.delete(uri);
    return;
  }
  if (method === 'textDocument/formatting') {
    const uri = params.textDocument && params.textDocument.uri;
    const text = documentText(uri);
    const formatted = format(text, {
      indentWidth: params.options && params.options.tabSize,
      insertSpaces: params.options ? params.options.insertSpaces !== false : true,
    });
    return send(id, [{ range: { start: { line: 0, character: 0 }, end: endPosition(text) }, newText: formatted }]);
  }
  if (id !== undefined) return send(id, null);
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
    const raw = buffer.slice(start, start + length).toString('utf8');
    buffer = buffer.slice(start + length);
    try { handle(JSON.parse(raw)); } catch (err) { process.stderr.write(`${err.message}\n`); }
  }
}
process.stdin.on('data', chunk => { buffer = Buffer.concat([buffer, chunk]); consume(); });
process.stdin.on('end', () => process.exit(shutdown ? 0 : 1));
