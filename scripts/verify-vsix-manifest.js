#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

function readZipEntry(archivePath, entryName) {
  const result = spawnSync('unzip', ['-p', archivePath, entryName], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Could not read ${entryName} from ${archivePath}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function verifyVsix(vsixPath, expectedVersion) {
  const packageJson = JSON.parse(readZipEntry(vsixPath, 'extension/package.json'));
  const manifestXml = readZipEntry(vsixPath, 'extension.vsixmanifest');
  const identityTag = manifestXml.match(/<Identity\b[^>]*\/?\s*>/);
  if (!identityTag) throw new Error('VSIX extension.vsixmanifest has no Identity element.');
  const identity = parseAttributes(identityTag[0]);

  const expected = {
    name: 'nexss-flow-syntax',
    publisher: 'nexssp',
    id: 'nexss-flow-syntax',
    version: expectedVersion,
  };
  const actual = {
    name: packageJson.name,
    publisher: packageJson.publisher,
    id: identity.Id,
    version: packageJson.version,
  };
  for (const field of Object.keys(expected)) {
    if (actual[field] !== expected[field]) {
      throw new Error(`VSIX ${field} mismatch: expected ${expected[field]}, got ${actual[field]}`);
    }
  }
  if (identity.Publisher !== expected.publisher || identity.Version !== expected.version) {
    throw new Error('VSIX identity publisher or version does not match its package manifest.');
  }
  return { ...actual, galleryId: `${actual.publisher}.${actual.id}` };
}

function main(argv) {
  if (argv.length !== 2) {
    throw new Error('Usage: verify-vsix-manifest.js <artifact.vsix> <expected-version>');
  }
  const [vsixPath, version] = argv;
  const metadata = verifyVsix(path.resolve(vsixPath), version);
  console.log(`Verified VSIX ${metadata.galleryId}@${metadata.version}`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyVsix };
