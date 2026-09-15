'use strict';

const DEFAULTS = Object.freeze({
  printWidth: 100,
  indentWidth: 2,
  insertSpaces: true,
  maxBlankLines: 1,
});

function normalizeOptions(options = {}) {
  const out = { ...DEFAULTS, ...options };
  out.printWidth = Math.max(40, Number(out.printWidth) || DEFAULTS.printWidth);
  out.indentWidth = Math.max(1, Number(out.indentWidth) || DEFAULTS.indentWidth);
  out.maxBlankLines = Math.max(0, Number(out.maxBlankLines) || 0);
  return out;
}

function protectStrings(text) {
  const strings = [];
  const masked = text.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, value => {
    const key = `\u0000${strings.length}\u0000`;
    strings.push(value);
    return key;
  });
  return { masked, restore: value => value.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[Number(i)]) };
}

function normalizeCode(text) {
  const { masked, restore } = protectStrings(text);
  let out = masked.trim();
  out = out.replace(/\s*(->|\|\||\||&|\?)\s*/g, ' $1 ');
  out = out.replace(/\s*:\s*/g, ':');
  out = out.replace(/\s*,\s*/g, ', ');
  out = out.replace(/\{\s*/g, '{ ');
  out = out.replace(/\s*\}/g, ' }');
  out = out.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  out = out.replace(/[ \t]+/g, ' ');
  out = out.replace(/([,{])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1 $2: ');
  return restore(out).trim();
}

function leadingCloseCount(line) {
  return /^[ \t]*[)}]/.test(line) ? 1 : 0;
}

function format(source, options = {}) {
  const opts = normalizeOptions(options);
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  while (rawLines.length && rawLines[rawLines.length - 1] === '') rawLines.pop();

  const result = [];
  let indent = 0;
  let blankCount = 0;
  let inBlockComment = false;
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (result.length && blankCount < opts.maxBlankLines) { result.push(''); blankCount++; }
      continue;
    }
    blankCount = 0;
    if (trimmed.startsWith('//')) {
      result.push(trimmed);
      continue;
    }
    if (trimmed.startsWith('/*')) inBlockComment = true;
    const isDirective = trimmed.startsWith('@');
    if (trimmed.startsWith('}') || trimmed.startsWith(')') || trimmed.startsWith('@end')) indent = Math.max(0, indent - 1);
    const code = isDirective ? trimmed : normalizeCode(trimmed);
    const prefix = opts.insertSpaces ? ' '.repeat(indent * opts.indentWidth) : '\t'.repeat(indent);
    result.push(prefix + code);
    const opens = (code.match(/[({]/g) || []).length;
    const closes = (code.match(/[)}]/g) || []).length;
    indent = Math.max(0, indent + opens - closes);
    if (code.startsWith('@pipeline ')) indent++;
    if (inBlockComment && trimmed.includes('*/')) inBlockComment = false;
  }
  return bom + result.join(newline).replace(/[ \t]+$/gm, '') + newline;
}

module.exports = { DEFAULTS, normalizeOptions, format };
