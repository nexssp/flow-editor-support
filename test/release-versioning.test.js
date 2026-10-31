'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { parseReleaseTag, stampEditorPackages } = require('../scripts/stamp-release-versions.js');
const { verifyReleaseArchives } = require('../scripts/verify-release-versions.js');
const { verifyVsix } = require('../scripts/verify-vsix-manifest.js');

const root = path.resolve(__dirname, '..');
const stampScript = path.join(root, 'scripts/stamp-release-versions.js');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeToml(file, identity, version = '0.1.0') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${identity}\nversion = "${version}"\n`);
}

function makeFixtureRoot(directory, version = '0.1.0') {
  writeJson(path.join(directory, 'vscode/package.json'), {
    name: 'nexss-flow-syntax',
    publisher: 'nexssp',
    version,
  });
  writeJson(path.join(directory, 'vscode/package-lock.json'), {
    name: 'nexss-flow-syntax',
    version,
    lockfileVersion: 3,
    packages: { '': { name: 'nexss-flow-syntax', version } },
  });
  writeToml(path.join(directory, 'zed/extension.toml'), 'id = "nexss-flow"', version);
  writeToml(path.join(directory, 'zed/Cargo.toml'), 'name = "zed_nexss_flow"', version);
  writeToml(
    path.join(directory, 'zed-legacy-0.230.2/extension.toml'),
    'id = "nexss-flow-legacy"',
    version,
  );
  writeToml(
    path.join(directory, 'zed-legacy-0.230.2/Cargo.toml'),
    'name = "zed_nexss_flow_legacy"',
    version,
  );
  writeJson(path.join(directory, 'claude/.claude-plugin/plugin.json'), {
    name: 'nexss-flow',
    version,
  });
}

function tomlVersion(file) {
  const contents = fs.readFileSync(file, 'utf8');
  const match = /^version = "([^"]+)"\s*$/m.exec(contents);
  assert.ok(match, `${file} must define a version`);
  return match[1];
}

function zipDirectory(directory, archivePath) {
  fs.rmSync(archivePath, { force: true });
  const zipped = spawnSync('zip', ['-q', '-r', archivePath, '.'], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(zipped.status, 0, zipped.stderr);
}

function createReleaseArchives(releaseRoot, artifactDirectory) {
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const sourceArchive = path.join(artifactDirectory, 'nexss-flow-source.zip');
  fs.rmSync(sourceArchive, { force: true });
  const sourceZip = spawnSync(
    'zip',
    ['-q', '-r', sourceArchive, 'vscode', 'zed', 'zed-legacy-0.230.2', 'claude'],
    { cwd: releaseRoot, encoding: 'utf8' },
  );
  assert.equal(sourceZip.status, 0, sourceZip.stderr);
  zipDirectory(path.join(releaseRoot, 'zed'), path.join(artifactDirectory, 'nexss-flow-zed.zip'));
  zipDirectory(
    path.join(releaseRoot, 'zed-legacy-0.230.2'),
    path.join(artifactDirectory, 'nexss-flow-zed-legacy-0.230.2.zip'),
  );
  zipDirectory(path.join(releaseRoot, 'claude'), path.join(artifactDirectory, 'nexss-flow-claude-code.zip'));
}

test('maps stable v-prefixed semantic release tags to extension versions', () => {
  assert.equal(parseReleaseTag('v0.3.9'), '0.3.9');
  assert.equal(parseReleaseTag('v12.34.56'), '12.34.56');
  for (const invalid of ['0.3.9', 'v0.03.9', 'v0.3', 'v0.3.9-rc.1', 'release-v0.3.9']) {
    assert.equal(parseReleaseTag(invalid), null, `${invalid} must not be treated as a stable release tag`);
  }
});

test('stamps all versioned packages in staged ZIP artifacts and leaves source files unchanged', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexss-version-stamp-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const sourceRoot = path.join(temp, 'source');
  const stagedRoot = path.join(temp, 'stage');
  const artifactDirectory = path.join(temp, 'artifacts');
  makeFixtureRoot(sourceRoot);
  fs.cpSync(sourceRoot, stagedRoot, { recursive: true });

  const sourceFiles = [
    'vscode/package.json',
    'vscode/package-lock.json',
    'zed/extension.toml',
    'zed/Cargo.toml',
    'zed-legacy-0.230.2/extension.toml',
    'zed-legacy-0.230.2/Cargo.toml',
    'claude/.claude-plugin/plugin.json',
  ];
  const originalSource = Object.fromEntries(
    sourceFiles.map((name) => [name, fs.readFileSync(path.join(sourceRoot, name), 'utf8')]),
  );

  const result = spawnSync(process.execPath, [stampScript, 'v0.3.9', stagedRoot], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const vscode = JSON.parse(fs.readFileSync(path.join(stagedRoot, 'vscode/package.json'), 'utf8'));
  const vscodeLock = JSON.parse(fs.readFileSync(path.join(stagedRoot, 'vscode/package-lock.json'), 'utf8'));
  assert.equal(vscode.version, '0.3.9');
  assert.equal(vscodeLock.version, '0.3.9');
  assert.equal(vscodeLock.packages[''].version, '0.3.9');
  assert.equal(tomlVersion(path.join(stagedRoot, 'zed/extension.toml')), '0.3.9');
  assert.equal(tomlVersion(path.join(stagedRoot, 'zed/Cargo.toml')), '0.3.9');
  assert.equal(tomlVersion(path.join(stagedRoot, 'zed-legacy-0.230.2/extension.toml')), '0.3.9');
  assert.equal(tomlVersion(path.join(stagedRoot, 'zed-legacy-0.230.2/Cargo.toml')), '0.3.9');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(stagedRoot, 'claude/.claude-plugin/plugin.json'), 'utf8')).version,
    '0.3.9',
  );
  for (const name of sourceFiles) {
    assert.equal(fs.readFileSync(path.join(sourceRoot, name), 'utf8'), originalSource[name]);
  }
  assert.throws(() => stampEditorPackages(stagedRoot, 'not-a-version'), /Refusing to stamp/);

  createReleaseArchives(stagedRoot, artifactDirectory);
  verifyReleaseArchives(artifactDirectory, '0.3.9');

  // Rebuild only the current Zed ZIP from the unstamped source copy: artifact verification must catch drift.
  zipDirectory(path.join(sourceRoot, 'zed'), path.join(artifactDirectory, 'nexss-flow-zed.zip'));
  assert.throws(() => verifyReleaseArchives(artifactDirectory, '0.3.9'), /version mismatch/);
});

test('verifies the packaged VSIX package and gallery identity for the requested release', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexss-vsix-verify-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const extensionDir = path.join(temp, 'extension');
  fs.mkdirSync(extensionDir);
  writeJson(path.join(extensionDir, 'package.json'), {
    name: 'nexss-flow-syntax',
    publisher: 'nexssp',
    version: '0.3.9',
  });
  fs.writeFileSync(
    path.join(temp, 'extension.vsixmanifest'),
    '<?xml version="1.0"?><PackageManifest><Metadata><Identity Id="nexss-flow-syntax" Version="0.3.9" Publisher="nexssp" /></Metadata></PackageManifest>\n',
  );
  const vsixPath = path.join(temp, 'candidate.vsix');
  const zipped = spawnSync('zip', ['-q', '-r', vsixPath, 'extension', 'extension.vsixmanifest'], {
    cwd: temp,
    encoding: 'utf8',
  });
  assert.equal(zipped.status, 0, zipped.stderr);
  assert.deepEqual(verifyVsix(vsixPath, '0.3.9'), {
    name: 'nexss-flow-syntax',
    publisher: 'nexssp',
    id: 'nexss-flow-syntax',
    version: '0.3.9',
    galleryId: 'nexssp.nexss-flow-syntax',
  });
  assert.throws(() => verifyVsix(vsixPath, '0.3.8'), /version mismatch/);
});
