#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function listZipEntries(archivePath) {
  const output = execFileSync('unzip', ['-Z', '-1', archivePath], { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

function readZipEntry(archivePath, expectedEntry, entries) {
  const matches = entries.filter((entry) => entry.replace(/^\.\//, '') === expectedEntry);
  if (matches.length !== 1) {
    throw new Error(`${path.basename(archivePath)} must contain exactly one ${expectedEntry}; found ${matches.length}.`);
  }
  return execFileSync('unzip', ['-p', archivePath, matches[0]], { encoding: 'utf8' });
}

function assertVersion(actual, expectedVersion, context) {
  if (actual !== expectedVersion) {
    throw new Error(`${context} version mismatch: expected ${expectedVersion}, got ${actual}.`);
  }
}

function verifyJsonVersion(archivePath, entry, expectedVersion, entries, identity) {
  const manifest = JSON.parse(readZipEntry(archivePath, entry, entries));
  for (const [field, value] of Object.entries(identity)) {
    if (manifest[field] !== value) {
      throw new Error(`${path.basename(archivePath)} ${entry} ${field} mismatch: expected ${value}, got ${manifest[field]}.`);
    }
  }
  assertVersion(manifest.version, expectedVersion, `${path.basename(archivePath)} ${entry}`);
  return manifest;
}

function tomlField(contents, field, archiveName, entry) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...contents.matchAll(new RegExp(`^${escaped} = "([^"]+)"[ \\t]*$`, 'gm'))];
  if (matches.length !== 1) {
    throw new Error(`${archiveName} ${entry} must contain exactly one ${field} field; found ${matches.length}.`);
  }
  return matches[0][1];
}

function verifyTomlVersion(archivePath, entry, expectedVersion, entries, identityField, expectedIdentity) {
  const archiveName = path.basename(archivePath);
  const contents = readZipEntry(archivePath, entry, entries);
  const actualIdentity = tomlField(contents, identityField, archiveName, entry);
  if (actualIdentity !== expectedIdentity) {
    throw new Error(`${archiveName} ${entry} ${identityField} mismatch: expected ${expectedIdentity}, got ${actualIdentity}.`);
  }
  assertVersion(tomlField(contents, 'version', archiveName, entry), expectedVersion, `${archiveName} ${entry}`);
}

function verifyVscode(archivePath, root, expectedVersion, entries) {
  const packageJson = verifyJsonVersion(
    archivePath,
    `${root}package.json`,
    expectedVersion,
    entries,
    { name: 'nexss-flow-syntax', publisher: 'nexssp' },
  );
  const lockfile = JSON.parse(readZipEntry(archivePath, `${root}package-lock.json`, entries));
  if (lockfile.name !== packageJson.name || !lockfile.packages || !lockfile.packages['']?.name) {
    throw new Error(`${path.basename(archivePath)} VS Code lockfile identity is invalid.`);
  }
  if (lockfile.packages[''].name !== packageJson.name) {
    throw new Error(`${path.basename(archivePath)} VS Code root lockfile identity does not match package.json.`);
  }
  assertVersion(lockfile.version, expectedVersion, `${path.basename(archivePath)} ${root}package-lock.json`);
  assertVersion(lockfile.packages[''].version, expectedVersion, `${path.basename(archivePath)} ${root}package-lock.json root package`);
}

const ARCHIVE_CHECKS = [
  {
    file: 'nexss-flow-source.zip',
    check(entries, archivePath, version) {
      verifyVscode(archivePath, 'vscode/', version, entries);
      verifyTomlVersion(archivePath, 'zed/extension.toml', version, entries, 'id', 'nexss-flow');
      verifyTomlVersion(archivePath, 'zed/Cargo.toml', version, entries, 'name', 'zed_nexss_flow');
      verifyTomlVersion(archivePath, 'zed-legacy-0.230.2/extension.toml', version, entries, 'id', 'nexss-flow-legacy');
      verifyTomlVersion(archivePath, 'zed-legacy-0.230.2/Cargo.toml', version, entries, 'name', 'zed_nexss_flow_legacy');
      verifyJsonVersion(archivePath, 'claude/.claude-plugin/plugin.json', version, entries, { name: 'nexss-flow' });
    },
  },
  {
    file: 'nexss-flow-zed.zip',
    check(entries, archivePath, version) {
      verifyTomlVersion(archivePath, 'extension.toml', version, entries, 'id', 'nexss-flow');
      verifyTomlVersion(archivePath, 'Cargo.toml', version, entries, 'name', 'zed_nexss_flow');
    },
  },
  {
    file: 'nexss-flow-zed-legacy-0.230.2.zip',
    check(entries, archivePath, version) {
      verifyTomlVersion(archivePath, 'extension.toml', version, entries, 'id', 'nexss-flow-legacy');
      verifyTomlVersion(archivePath, 'Cargo.toml', version, entries, 'name', 'zed_nexss_flow_legacy');
    },
  },
  {
    file: 'nexss-flow-claude-code.zip',
    check(entries, archivePath, version) {
      verifyJsonVersion(archivePath, '.claude-plugin/plugin.json', version, entries, { name: 'nexss-flow' });
    },
  },
];

function verifyReleaseArchives(artifactDirectory, expectedVersion) {
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(expectedVersion)) {
    throw new Error(`Refusing to verify invalid package version: ${expectedVersion}`);
  }
  for (const archive of ARCHIVE_CHECKS) {
    const archivePath = path.join(artifactDirectory, archive.file);
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Missing release archive: ${archive.file}`);
    }
    const entries = listZipEntries(archivePath);
    archive.check(entries, archivePath, expectedVersion);
    console.log(`Verified ${archive.file} package metadata @ ${expectedVersion}`);
  }
}

function main(argv) {
  if (argv.length !== 2) {
    throw new Error('Usage: verify-release-versions.js <expected-version> <artifact-directory>');
  }
  verifyReleaseArchives(path.resolve(argv[1]), argv[0]);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyReleaseArchives };
