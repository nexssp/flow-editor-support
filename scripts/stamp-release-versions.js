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

function stampVscodePackage(directory, version) {
  const manifestPath = path.join(directory, 'package.json');
  const lockfilePath = path.join(directory, 'package-lock.json');
  const manifest = readJson(manifestPath);
  const lockfile = readJson(lockfilePath);

  if (manifest.name !== 'nexss-flow-syntax' || manifest.publisher !== 'nexssp') {
    throw new Error('Refusing to stamp an unexpected VS Code extension identity.');
  }
  if (!lockfile.packages || !lockfile.packages['']) {
    throw new Error('VS Code package-lock.json is missing its root package record.');
  }
  if (lockfile.name !== manifest.name || lockfile.packages[''].name !== manifest.name) {
    throw new Error('VS Code package-lock.json identity does not match package.json.');
  }

  manifest.version = version;
  lockfile.version = version;
  lockfile.packages[''].version = version;
  writeJson(manifestPath, manifest);
  writeJson(lockfilePath, lockfile);
}

function stampTomlVersion(filePath, identityPattern, expectedIdentity, version) {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (!identityPattern.test(contents)) {
    throw new Error(`Refusing to stamp unexpected package identity in ${filePath}; expected ${expectedIdentity}.`);
  }
  const versionLines = [...contents.matchAll(/^version = "[^"]+"[ \t]*$/gm)];
  if (versionLines.length !== 1) {
    throw new Error(`Expected one version field in ${filePath}, found ${versionLines.length}.`);
  }
  const stamped = contents.replace(/^version = "[^"]+"(?=[ \t]*$)/m, `version = "${version}"`);
  fs.writeFileSync(filePath, stamped);
}

function exactTomlField(field, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${field} = "${escaped}"[ \\t]*$`, 'm');
}

function stampZedPackage(directory, extensionId, crateName, version) {
  stampTomlVersion(
    path.join(directory, 'extension.toml'),
    exactTomlField('id', extensionId),
    `extension id ${extensionId}`,
    version,
  );
  stampTomlVersion(
    path.join(directory, 'Cargo.toml'),
    exactTomlField('name', crateName),
    `Cargo package ${crateName}`,
    version,
  );
}

function stampClaudePlugin(directory, version) {
  const pluginPath = path.join(directory, '.claude-plugin', 'plugin.json');
  const plugin = readJson(pluginPath);
  if (plugin.name !== 'nexss-flow') {
    throw new Error('Refusing to stamp an unexpected Claude Code plugin identity.');
  }
  plugin.version = version;
  writeJson(pluginPath, plugin);
}

function stampEditorPackages(releaseRoot, version) {
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) {
    throw new Error(`Refusing to stamp invalid package version: ${version}`);
  }
  stampVscodePackage(path.join(releaseRoot, 'vscode'), version);
  stampZedPackage(path.join(releaseRoot, 'zed'), 'nexss-flow', 'zed_nexss_flow', version);
  stampZedPackage(
    path.join(releaseRoot, 'zed-legacy-0.230.2'),
    'nexss-flow-legacy',
    'zed_nexss_flow_legacy',
    version,
  );
  stampClaudePlugin(path.join(releaseRoot, 'claude'), version);
}

function main(argv) {
  if (argv.length !== 2) {
    throw new Error('Usage: stamp-release-versions.js <vMAJOR.MINOR.PATCH tag> <staged-release-root>');
  }
  const [tag, releaseRoot] = argv;
  const version = parseReleaseTag(tag);
  if (!version) {
    throw new Error(`Not a stable semantic release tag: ${tag}`);
  }
  stampEditorPackages(path.resolve(releaseRoot), version);
  console.log(`Stamped VS Code, Zed, legacy Zed, and Claude Code packages as ${version}`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parseReleaseTag,
  stampVscodePackage,
  stampTomlVersion,
  stampZedPackage,
  stampClaudePlugin,
  stampEditorPackages,
};
