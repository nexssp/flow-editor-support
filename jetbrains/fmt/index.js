'use strict';

const DEFAULTS = Object.freeze({
  indentWidth: 2,
  maxBlankLines: 1,
});

function protectStrings(text) {
  const strings = [];
  const masked = text.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, value => {
    const key = `\u0000${strings.length}\u0000`;
    strings.push(value);
    return key;
  });
  return { masked, restore: value => value.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[Number(i)]) };
}

function scanLine(text, initialQuote = '') {
  let quote = initialQuote;
  let masked = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      masked += ' ';
      if (c === '\\' && i + 1 < text.length) { masked += ' '; i++; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      return { masked: masked + ' '.repeat(text.length - i), quote, commentIndex: i };
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; masked += ' '; continue; }
    masked += c;
  }
  return { masked, quote, commentIndex: -1 };
}

function splitSlashComment(text) {
  const { commentIndex } = scanLine(text);
  return commentIndex < 0 ? [text, ''] : [text.slice(0, commentIndex), text.slice(commentIndex)];
}

function ternaryColonOffsets(text) {
  const offsets = new Set();
  const delimiters = [];
  const questions = new Map();
  const depthKey = () => delimiters.join('');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '{' || c === '[') {
      delimiters.push(c);
      continue;
    }
    if (c === ')' || c === '}' || c === ']') {
      delimiters.pop();
      continue;
    }
    const key = depthKey();
    if (c === '?') {
      questions.set(key, (questions.get(key) || 0) + 1);
      continue;
    }
    if (c !== ':' || !questions.get(key)) continue;
    // Flow uses a colon followed by whitespace as the ternary separator;
    // adjacent colons are modifiers or object-field syntax instead.
    if (/\s/.test(text[i - 1] || '') || /\s/.test(text[i + 1] || '')) {
      offsets.add(i);
      questions.set(key, questions.get(key) - 1);
    }
  }
  return offsets;
}

function normalizeCode(text, { lineLeadingField = false } = {}) {
  const { masked, restore } = protectStrings(text);
  let out = masked.trim();
  if (lineLeadingField) {
    out = out.replace(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*/, (_, field) => `${field}:\u0001`);
  }
  out = out.replace(/\s*(->|==|!=|>=|<=|&&|\|\||\||&|\?|>|<)\s*/g, ' $1 ');
  const ternaryColons = ternaryColonOffsets(out);
  out = out.replace(/\s*:\s*/g, (match, offset) => {
    const colonOffset = offset + match.indexOf(':');
    return ternaryColons.has(colonOffset) ? ' : ' : ':';
  });
  out = out.replace(/\s*,\s*/g, ', ');
  out = out.replace(/\{\s*/g, '{ ');
  out = out.replace(/\s*\}/g, ' }');
  out = out.replace(/\{\s+\}/g, '{}');
  out = out.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  out = out.replace(/[ \t]+/g, ' ');
  out = out.replace(/([,{])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1 $2: ');
  out = out.replace(/\u0001/g, ' ');
  return restore(out).trim();
}

function isFieldMapBlock(prefix) {
  const context = prefix.trim();
  const controlBlock = /(?:^|\s)(?:race|match)(?:\s*\([^{}]*\))?\s*$/.test(context);
  return !controlBlock && !/^@(?:assert|schema)\b/.test(context);
}

function updateBraceContexts(maskedLine, contexts) {
  for (let i = 0; i < maskedLine.length; i++) {
    if (maskedLine[i] === '{') contexts.push(isFieldMapBlock(maskedLine.slice(0, i)));
    else if (maskedLine[i] === '}' && contexts.length) contexts.pop();
  }
}

function normalizeAssertDirective(text) {
  const match = text.match(/^(@assert)(?![A-Za-z0-9_.-])(:)?[ \t]*(.*)$/);
  if (!match || !match[3].trim()) return text;
  const prefix = `${match[1]}${match[2] || ''}`;
  const body = match[3].trim();
  if (body === '{') return `${prefix} {`;
  if (body.startsWith('{')) {
    if (!body.endsWith('}')) return text;
    const inner = body.slice(1, -1);
    if (!inner.trim()) return `${prefix} {}`;
    return `${prefix} { ${normalizeCode(inner)} }`;
  }
  return `${prefix} ${normalizeCode(body)}`;
}

function format(source) {
  const opts = DEFAULTS;
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  while (rawLines.length && rawLines[rawLines.length - 1] === '') rawLines.pop();

  const result = [];
  const braceContexts = [];
  let indent = 0;
  let blankCount = 0;
  let multilineQuote = '';
  for (const raw of rawLines) {
    const scan = scanLine(raw, multilineQuote);
    if (multilineQuote || scan.quote) {
      const structural = scan.masked.trim();
      if (structural.startsWith('}') || structural.startsWith(')') || structural.startsWith('@end')) {
        indent = Math.max(0, indent - 1);
      }
      result.push(raw);
      const opens = (scan.masked.match(/[({[]/g) || []).length;
      const closes = (scan.masked.match(/[)}\]]/g) || []).length;
      indent = Math.max(0, indent + opens - closes);
      if (structural.startsWith('@pipeline ')) indent++;
      updateBraceContexts(scan.masked, braceContexts);
      multilineQuote = scan.quote;
      blankCount = 0;
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      if (result.length && blankCount < opts.maxBlankLines) { result.push(''); blankCount++; }
      continue;
    }
    blankCount = 0;

    // Full-line comments are left alone. `#` is also used as a target selector
    // and an expr-lang predicate, so only whole-line hashes are comments here.
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      result.push(trimmed);
      continue;
    }

    const [codeText, comment] = splitSlashComment(trimmed);
    const codeTrimmed = codeText.trim();
    const isDirective = codeTrimmed.startsWith('@');
    const structural = scan.masked.trim();
    if (structural.startsWith('}') || structural.startsWith(')') || structural.startsWith('@end')) {
      indent = Math.max(0, indent - 1);
    }
    const code = isDirective
      ? (codeTrimmed.startsWith('@assert') ? normalizeAssertDirective(codeTrimmed) : codeTrimmed)
      : normalizeCode(codeTrimmed, { lineLeadingField: braceContexts[braceContexts.length - 1] === true });
    const prefix = ' '.repeat(indent * opts.indentWidth);
    result.push(prefix + code + (comment ? ` ${comment}` : ''));

    const opens = (scan.masked.match(/[({[]/g) || []).length;
    const closes = (scan.masked.match(/[)}\]]/g) || []).length;
    indent = Math.max(0, indent + opens - closes);
    if (structural.startsWith('@pipeline ')) indent++;
    updateBraceContexts(scan.masked, braceContexts);
  }
  return bom + result.join(newline) + newline;
}

module.exports = { DEFAULTS, format };
