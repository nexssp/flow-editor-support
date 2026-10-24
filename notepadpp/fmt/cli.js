#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { format } = require('./index.js');

function help() {
  process.stdout.write(`flowfmt [options] [files...]\n\n  --write, -w  Rewrite files in place\n  --check      Exit 1 when formatting is needed\n  --stdin      Read stdin and write formatted output to stdout\n  --version    Show flowfmt version\n`);
}

function parse(argv) {
  const opts = { files: [], stdin: false, write: false, check: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--version') { opts.version = true; continue; }
    if (arg === '--write' || arg === '-w') { opts.write = true; continue; }
    if (arg === '--check') { opts.check = true; continue; }
    if (arg === '--stdin') { opts.stdin = true; continue; }
    if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    opts.files.push(arg);
  }
  if (opts.write && opts.check) throw new Error('--write and --check are mutually exclusive');
  if (opts.stdin && opts.files.length) throw new Error('--stdin cannot be combined with file paths');
  return opts;
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function main(argv) {
  const opts = parse(argv);
  if (opts.help) return help();
  if (opts.version) return process.stdout.write('flowfmt 0.1.0\n');
  if (!opts.stdin && opts.files.length === 0) throw new Error('no input files; use --stdin or provide a .nflow file');

  if (opts.stdin) {
    process.stdout.write(format(await readStdin()));
    return;
  }

  let changed = false;
  for (const name of opts.files) {
    const input = fs.readFileSync(name, 'utf8');
    const output = format(input);
    if (output !== input) changed = true;
    if (opts.check) {
      if (output !== input) process.stdout.write(`${name}\n`);
    } else if (opts.write) {
      if (output !== input) fs.writeFileSync(name, output);
    } else {
      process.stdout.write(output);
    }
  }
  if (opts.check && changed) process.exitCode = 1;
}

main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`flowfmt: ${error.message}\n`);
  process.exitCode = 2;
});
