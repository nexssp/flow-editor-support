#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const formatterPath = [
  path.join(__dirname, '..', 'fmt', 'index.js'),
  path.join(__dirname, '..', '..', 'fmt', 'index.js'),
].find(file => fs.existsSync(file));
if (!formatterPath) throw new Error('nflow formatter adapter not found');
const { format } = require(formatterPath);

// Formatting is intentionally delegated to Flow's `nflow fmt` command. This
// server provides editor protocol integration, never an independent formatter.
const snippets = [
  ['flow-pipe', 'source.node\n-> target.node', 'Sequential pipeline'],
  ['flow-args', 'action.node @{ value: ${1:.input} }', 'Structured action arguments'],
  ['flow-parallel', 'parallel {\n  first: ${1:action.one},\n  second: ${2:action.two},\n}', 'Named parallel fan-out'],
  ['flow-race', 'race {\n  ${1:action.one},\n  ${2:action.two},\n}', 'First successful alternative'],
  ['flow-match', 'match {\n  ${1:.condition} -> ${2:action.one},\n  _ -> ${3:action.other}\n}', 'Match input against ordered arms'],
  ['flow-fallback', '( primary.node || fallback.node )', 'Fallback chain'],
  ['flow-if', 'gate ? target.node', 'Conditional node'],
  ['flow-projection', '{ field: .input }', 'Inline projection'],
  ['flow-loop', 'loop( body.node ) until( condition )', 'Bounded loop'],
  ['flow-node', 'namespace.node :timeout=10s :retry=2', 'Configured action node'],
  ['flow-pipeline', '@pipeline name\n  :timeout=10s\n  :retry=2\n\n  ${1:source.node}\n@end', 'Named pipeline with multiline modifiers'],
  ['flow-assert', '@assert {\n  result.ok == true\n}', 'Post-run assertion block'],
  ['flow-assert-expression', '@assert: ${1:result.ok == true}', 'Single-expression assertion (Flow v0.42.0)'],
  ['flow-assert-inline', '@assert: { ${1:result.ok == true}, ${2:result.count > 0} }', 'Compact assertion list (Flow v0.42.0)'],
  ['flow-assert-call', 'assert(${1:condition}, "${2:failure message}")', 'Runtime assertion expression'],
];
let buffer = Buffer.alloc(0);
let shutdown = false;
let nflowCommand;
const documents = new Map();

function send(id, result, error) {
  const payload = JSON.stringify(error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`);
}
function notify(method, params) {
  const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`);
}
function completionItems(position = { line: 0, character: 0 }, context = {}) {
  const typedAtTrigger = context.triggerKind === 2 && context.triggerCharacter === '@';
  return snippets.map(([label, insertText, detail]) => {
    const start = typedAtTrigger && insertText.startsWith('@') && position.character > 0
      ? { ...position, character: position.character - 1 }
      : position;
    return {
      label, kind: 15, detail, insertTextFormat: 2,
      textEdit: { newText: insertText, range: { start, end: position } },
    };
  });
}
function endPosition(text) {
  const lines = text.split(/\r?\n/);
  // JavaScript string length is UTF-16 code units, matching LSP's default encoding.
  return { line: Math.max(0, lines.length - 1), character: (lines[lines.length - 1] || '').length };
}
function documentText(uri) { return documents.get(uri) || ''; }
function sourceDiagnostic(text, message) {
  const matches = [...message.matchAll(/(?:<stdin>|[^\s:]+):(\d+)(?::(\d+))?:\s*([^\r\n]+)/g)];
  if (!matches.length) return undefined;
  const match = matches[matches.length - 1];
  const lines = text.split(/\r?\n/);
  const line = Math.max(0, Math.min(lines.length - 1, Number(match[1]) - 1));
  const sourceLine = lines[line] || '';
  const byteColumn = match[2] ? Math.max(1, Number(match[2])) - 1 : 0;
  const character = Buffer.from(sourceLine, 'utf8').subarray(0, byteColumn).toString('utf8').length;
  return {
    range: { start: { line, character }, end: { line, character: Math.min(sourceLine.length, character + 1) } },
    severity: 1,
    source: 'nflow fmt',
    message: match[3].trim(),
  };
}
function extractText(params) {
  if (params.textDocument && typeof params.textDocument.text === 'string') return params.textDocument.text;
  const changes = params.contentChanges || [];
  return changes.length && typeof changes[changes.length - 1].text === 'string' ? changes[changes.length - 1].text : '';
}
function handle(msg) {
  const { id, method, params = {} } = msg;
  if (method === 'initialize') {
    const configured = params.initializationOptions && params.initializationOptions.nflowCommand;
    if (typeof configured === 'string' && configured.trim()) nflowCommand = configured.trim();
    return send(id, { capabilities: {
      textDocumentSync: 1,
      documentFormattingProvider: true,
      completionProvider: { triggerCharacters: ['@', ':', '.', ' ', '-', '|', '&', '?', '{'] },
      hoverProvider: true,
      definitionProvider: false,
    }, serverInfo: { name: 'nexss-flow-lsp-stub', version: '0.2.0' } });
  }
  if (method === 'shutdown') { shutdown = true; return send(id, null); }
  if (method === 'exit') { process.exit(shutdown ? 0 : 1); }
  if (method === 'textDocument/completion') return send(id, { isIncomplete: false, items: completionItems(params.position || { line: 0, character: 0 }, params.context) });
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
    try {
      const formatted = format(text, { command: nflowCommand });
      notify('textDocument/publishDiagnostics', { uri, diagnostics: [] });
      return send(id, [{ range: { start: { line: 0, character: 0 }, end: endPosition(text) }, newText: formatted }]);
    } catch (err) {
      const diagnostic = sourceDiagnostic(text, err.message);
      if (diagnostic) notify('textDocument/publishDiagnostics', { uri, diagnostics: [diagnostic] });
      return send(id, null, { code: -32603, message: err.message });
    }
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
    let msg;
    try {
      msg = JSON.parse(raw);
      handle(msg);
    } catch (err) {
      if (msg && msg.id !== undefined) send(msg.id, null, { code: -32603, message: err.message });
      else process.stderr.write(`${err.message}\n`);
    }
  }
}
process.stdin.on('data', chunk => { buffer = Buffer.concat([buffer, chunk]); consume(); });
process.stdin.on('end', () => process.exit(shutdown ? 0 : 1));
