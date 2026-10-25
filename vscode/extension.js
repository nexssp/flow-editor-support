'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const { LanguageClient } = require('vscode-languageclient/node');

let client;

async function activate(context) {
  const configuration = vscode.workspace.getConfiguration('nexssFlow');
  const configuredServer = (configuration.get('languageServer.command') || '').trim();
  const configuredArgs = configuration.get('languageServer.args') || [];
  const nflowCommand = (configuration.get('nflowCommand') || '').trim();
  const env = { ...process.env };
  if (nflowCommand) env.NFLOW_BIN = nflowCommand;

  let serverOptions;
  if (configuredServer) {
    serverOptions = { command: configuredServer, args: configuredArgs, options: { env } };
  } else {
    const packagedLauncher = path.join(context.extensionPath, 'lsp', 'nflow-lsp.js');
    const sourceLauncher = path.resolve(context.extensionPath, '..', 'lsp', 'nflow-lsp.js');
    const launcher = fs.existsSync(packagedLauncher) ? packagedLauncher : sourceLauncher;
    serverOptions = { command: process.execPath, args: [launcher], options: { env } };
  }

  client = new LanguageClient(
    'nexss-flow',
    'Nexss Flow',
    serverOptions,
    { documentSelector: [{ scheme: 'file', language: 'nexss-flow' }] },
  );
  context.subscriptions.push(client);
  await client.start();
}

async function deactivate() {
  if (!client) return;
  const activeClient = client;
  client = undefined;
  await activeClient.stop();
}

module.exports = { activate, deactivate };
