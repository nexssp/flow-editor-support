#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { format, DEFAULTS } = require('./index.js');

function help() {
  process.stdout.write(`flowfmt [options] [files...]\n\n  --write, -w       Rewrite files in place\n  --check           Exit 1 when formatting is needed\n  --stdin           Read stdin and write stdout\n  --print-width N   Formatting width (default ${DEFAULTS.printWidth})\n  --indent-width N  Indentation width (default ${DEFAULTS.indentWidth})\n  --no-blank-lines  Remove blank lines\n  --version         Show version\n`);
}
function parse(argv) {
  const opts = { ...DEFAULTS, files: [], stdin: false, write: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--version') { opts.version = true; continue; }
    if (arg === '--write' || arg === '-w') { opts.write = true; continue; }
    if (arg === '--check') { opts.check = true; continue; }
    if (arg === '--stdin') { opts.stdin = true; continue; }
    if (arg === '--no-blank-lines') { opts.maxBlankLines = 0; continue; }
    if (arg === '--print-width' || arg === '--indent-width') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value)) throw new Error(`${arg} requires a number`);
      if (arg === '--print-width') opts.printWidth = value; else opts.indentWidth = value;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    opts.files.push(arg);
  }
  return opts;
}
function readStdin() { return new Promise(resolve => { let data = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => resolve(data)); }); }
async function main(argv) {
  const opts = parse(argv);
  if (opts.help) return help();
  if (opts.version) return process.stdout.write('flowfmt 0.1.0\n');
  if (!opts.stdin && opts.files.length === 0) throw new Error('no input files; use --stdin or provide a .flow file');
  if (opts.stdin) {
    const input = await readStdin();
    process.stdout.write(format(input, opts));
    return;
  }
  let changed = false;
  for (const name of opts.files) {
    const input = fs.readFileSync(name, 'utf8');
    const output = format(input, opts);
    if (output !== input) changed = true;
    if (opts.check) { if (output !== input) process.stdout.write(`${name}\n`); }
    else if (opts.write) { if (output !== input) fs.writeFileSync(name, output); }
    else process.stdout.write(output);
  }
  if (opts.check && changed) process.exitCode = 1;
}
main(process.argv.slice(2)).catch(error => { process.stderr.write(`flowfmt: ${error.message}\n`); process.exitCode = 2; });
