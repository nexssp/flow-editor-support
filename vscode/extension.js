'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const vscode = require('vscode');
const { LanguageClient, RevealOutputChannelOn, Trace } = require('vscode-languageclient/node');
const { nflowExecutable } = require('./lsp/nflow-command');

const traceLevels = {
  off: Trace.Off,
  messages: Trace.Messages,
  verbose: Trace.Verbose,
};

function configuredTraceLevel(configuration) {
  return traceLevels[configuration.get('trace.server', 'off')] ?? Trace.Off;
}

function configuredFlowExecutable(configuration, env = process.env) {
  const configured = (configuration.get('nflowCommand') || '').trim();
  if (configured) return configured;
  return nflowExecutable(env);
}

function reportFlowExecutable(outputChannel, configuration) {
  const executable = configuredFlowExecutable(configuration);
  outputChannel.clear();
  outputChannel.appendLine(`Configured Flow executable: ${executable}`);
  return new Promise(resolve => {
    const finish = (error, stdout = '', stderr = '') => {
      const versionOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (error) outputChannel.appendLine(`Version check failed: ${error.message}`);
      if (versionOutput) outputChannel.appendLine(versionOutput);
      else if (!error) outputChannel.appendLine('(no version output)');
      outputChannel.show(true);
      resolve();
    };
    try {
      execFile(executable, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true }, finish);
    } catch (error) {
      finish(error);
    }
  });
}

let client;

async function activate(context) {
  const configuration = vscode.workspace.getConfiguration('nexssFlow');
  const configuredServer = (configuration.get('languageServer.command') || '').trim();
  const configuredArgs = configuration.get('languageServer.args') || [];
  const nflowCommand = (configuration.get('nflowCommand') || '').trim();
  const env = { ...process.env };
  if (nflowCommand) env.NFLOW_BIN = nflowCommand;
  const outputChannel = vscode.window.createOutputChannel('Nexss Flow Language Server');
  const traceOutputChannel = vscode.window.createOutputChannel('Nexss Flow LSP Trace');
  const executableOutputChannel = vscode.window.createOutputChannel('Nexss Flow Executable');
  const showOutputCommand = vscode.commands.registerCommand('nexssFlow.showLanguageServerOutput', () => {
    outputChannel.show(true);
  });
  const showTraceCommand = vscode.commands.registerCommand('nexssFlow.showLanguageServerTrace', () => {
    traceOutputChannel.show(true);
  });
  const showExecutableCommand = vscode.commands.registerCommand('nexssFlow.showFlowExecutable', () => {
    return reportFlowExecutable(executableOutputChannel, vscode.workspace.getConfiguration('nexssFlow'));
  });
  const traceConfiguration = vscode.workspace.onDidChangeConfiguration(event => {
    if (!event.affectsConfiguration('nexssFlow.trace.server') || !client) return;
    void client.setTrace(configuredTraceLevel(vscode.workspace.getConfiguration('nexssFlow')));
  });
  context.subscriptions.push(outputChannel, traceOutputChannel, executableOutputChannel, showOutputCommand, showTraceCommand, showExecutableCommand, traceConfiguration);

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
    {
      documentSelector: [{ scheme: 'file', language: 'nexss-flow' }],
      outputChannel,
      traceOutputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Error,
    },
  );
  context.subscriptions.push(client);
  await client.start();
  await client.setTrace(configuredTraceLevel(configuration));
}

async function deactivate() {
  if (!client) return;
  const activeClient = client;
  client = undefined;
  await activeClient.stop();
}

module.exports = { activate, deactivate };
