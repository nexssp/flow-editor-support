'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { parseReleaseTag } = require('../scripts/stamp-vscode-version.js');
const { verifyVsix } = require('../scripts/verify-vsix-manifest.js');

const root = path.resolve(__dirname, '..');
const stampScript = path.join(root, 'scripts/stamp-vscode-version.js');
const fixturePackage = {
  name: 'nexss-flow-syntax',
  publisher: 'nexssp',
  version: '0.1.0',
};
const fixtureLock = {
  name: 'nexss-flow-syntax',
  version: '0.1.0',
  lockfileVersion: 3,
  packages: {
    '': { name: 'nexss-flow-syntax', version: '0.1.0' },
  },
};

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('maps a stable v-prefixed semantic release tag to the extension version', () => {
  assert.equal(parseReleaseTag('v0.3.5'), '0.3.5');
  assert.equal(parseReleaseTag('v12.34.56'), '12.34.56');
  for (const invalid of ['0.3.5', 'v0.03.5', 'v0.3', 'v0.3.5-rc.1', 'release-v0.3.5']) {
    assert.equal(parseReleaseTag(invalid), null, `${invalid} must not be treated as a stable release tag`);
  }
});

test('stamps only the staged VS Code manifest and lockfile, leaving source bytes unchanged', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexss-version-stamp-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const sourceDir = path.join(temp, 'source', 'vscode');
  const stagedDir = path.join(temp, 'stage', 'vscode');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(stagedDir, { recursive: true });
  writeJson(path.join(sourceDir, 'package.json'), fixturePackage);
  writeJson(path.join(sourceDir, 'package-lock.json'), fixtureLock);
  for (const filename of ['package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(sourceDir, filename), path.join(stagedDir, filename));
  }
  const originalSource = Object.fromEntries(
    ['package.json', 'package-lock.json'].map((name) => [name, fs.readFileSync(path.join(sourceDir, name), 'utf8')]),
  );

  const result = spawnSync(process.execPath, [stampScript, 'v0.3.5', stagedDir], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(stagedDir, 'package.json'), 'utf8'));
  const lockfile = JSON.parse(fs.readFileSync(path.join(stagedDir, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.version, '0.3.5');
  assert.equal(lockfile.version, '0.3.5');
  assert.equal(lockfile.packages[''].version, '0.3.5');
  for (const filename of Object.keys(originalSource)) {
    assert.equal(fs.readFileSync(path.join(sourceDir, filename), 'utf8'), originalSource[filename]);
  }
});

test('verifies the packaged VSIX package and gallery identity for the requested release', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexss-vsix-verify-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const extensionDir = path.join(temp, 'extension');
  fs.mkdirSync(extensionDir);
  writeJson(path.join(extensionDir, 'package.json'), { ...fixturePackage, version: '0.3.5' });
  fs.writeFileSync(
    path.join(temp, 'extension.vsixmanifest'),
    '<?xml version="1.0"?><PackageManifest><Metadata><Identity Id="nexss-flow-syntax" Version="0.3.5" Publisher="nexssp" /></Metadata></PackageManifest>\n',
  );
  const vsixPath = path.join(temp, 'candidate.vsix');
  const zipped = spawnSync('zip', ['-q', '-r', vsixPath, 'extension', 'extension.vsixmanifest'], {
    cwd: temp,
    encoding: 'utf8',
  });
  assert.equal(zipped.status, 0, zipped.stderr);
  assert.deepEqual(verifyVsix(vsixPath, '0.3.5'), {
    name: 'nexss-flow-syntax',
    publisher: 'nexssp',
    id: 'nexss-flow-syntax',
    version: '0.3.5',
    galleryId: 'nexssp.nexss-flow-syntax',
  });
  assert.throws(() => verifyVsix(vsixPath, '0.3.4'), /version mismatch/);
});
