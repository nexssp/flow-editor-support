#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseReleaseTag(tag) {
  if (typeof tag !== 'string') return null;
  const match = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(tag);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function stampVscodePackage(vscodeDirectory, version) {
  const manifestPath = path.join(vscodeDirectory, 'package.json');
  const lockfilePath = path.join(vscodeDirectory, 'package-lock.json');
  const manifest = readJson(manifestPath);
  const lockfile = readJson(lockfilePath);

  if (manifest.name !== 'nexss-flow-syntax' || manifest.publisher !== 'nexssp') {
    throw new Error('Refusing to stamp an unexpected VS Code extension identity.');
  }
  if (!lockfile.packages || !lockfile.packages['']) {
    throw new Error('VS Code package-lock.json is missing its root package record.');
  }

  manifest.version = version;
  lockfile.version = version;
  lockfile.packages[''].version = version;
  writeJson(manifestPath, manifest);
  writeJson(lockfilePath, lockfile);
}

function main(argv) {
  if (argv.length !== 2) {
    throw new Error('Usage: stamp-vscode-version.js <vMAJOR.MINOR.PATCH tag> <staged-vscode-directory>');
  }
  const [tag, vscodeDirectory] = argv;
  const version = parseReleaseTag(tag);
  if (!version) {
    throw new Error(`Not a stable semantic release tag: ${tag}`);
  }
  stampVscodePackage(vscodeDirectory, version);
  console.log(`Stamped staged Nexss Flow VS Code package as ${version}`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseReleaseTag, stampVscodePackage };
