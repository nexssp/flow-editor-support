'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function createNflowMock(t, config = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-nflow-mock-'));
  const executable = path.join(directory, 'nflow');
  const logPath = path.join(directory, 'calls.jsonl');
  const mockConfig = { ...config, logPath };
  const source = `#!/usr/bin/env node\n'use strict';\n`
    + `const fs = require('node:fs');\n`
    + `const cfg = ${JSON.stringify(mockConfig)};\n`
    + `const args = process.argv.slice(2);\n`
    + `const input = fs.readFileSync(0, 'utf8');\n`
    + `if (cfg.logPath) fs.appendFileSync(cfg.logPath, JSON.stringify({ args, input }) + '\\n');\n`
    + `if (args[0] !== 'fmt') { process.stderr.write('expected fmt subcommand'); process.exit(64); }\n`
    + `if (cfg.exitCode) { if (cfg.stderr) process.stderr.write(cfg.stderr); process.exit(cfg.exitCode); }\n`
    + `const output = Object.prototype.hasOwnProperty.call(cfg.outputs || {}, input) ? cfg.outputs[input] : input;\n`
    + `process.stdout.write(output);\n`;
  fs.writeFileSync(executable, source, { mode: 0o755 });
  fs.chmodSync(executable, 0o755);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    executable,
    logPath,
    env: {
      ...process.env,
      NFLOW_BIN: executable,
    },
  };
}

function readCalls(mock) {
  if (!fs.existsSync(mock.logPath)) return [];
  return fs.readFileSync(mock.logPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

module.exports = { createNflowMock, readCalls };
