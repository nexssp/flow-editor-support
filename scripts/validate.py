#!/usr/bin/env python3
"""Dependency-free consistency checks for every Nexss Flow editor integration."""
from pathlib import Path
import json
import tomllib
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
required = [
    'README.md', 'LICENSE', 'package.json', 'grammar.js', 'src/parser.c', 'src/node-types.json',
    'assets/nexss-logo.png', 'examples/complete.nflow', 'test/fixtures/current-syntax.nflow',
    'fmt/index.js', 'fmt/cli.js', 'fmt/test/formatter.test.js', 'fmt/test/lsp.test.js',
    'fmt/test/fixtures/pipeline.nflow', 'fmt/test/fixtures/pipeline.expected.nflow',
    'lsp/flow-language-server.js', 'scripts/validate.py', 'scripts/check-grammar.sh', 'scripts/package-release.sh',
    'zed/extension.toml', 'zed/grammars/flow.js', 'zed/languages/flow/config.toml',
    'zed/languages/flow/highlights.scm', 'zed/languages/flow/brackets.scm',
    'zed/lsp/flow-language-server.js', 'zed/fmt/index.js', 'zed/logo.png', 'zed/Cargo.toml', 'zed/src/flow_extension.rs',
    'zed-legacy-0.230.2/extension.toml', 'zed-legacy-0.230.2/languages/flow/config.toml',
    'zed-legacy-0.230.2/languages/flow/highlights.scm', 'zed-legacy-0.230.2/languages/flow/brackets.scm',
    'zed-legacy-0.230.2/grammar.js', 'zed-legacy-0.230.2/grammars/flow.js',
    'zed-legacy-0.230.2/lsp/flow-language-server.js', 'zed-legacy-0.230.2/fmt/index.js',
    'zed-legacy-0.230.2/logo.png', 'zed-legacy-0.230.2/Cargo.toml', 'zed-legacy-0.230.2/src/flow_extension.rs',
    'vscode/package.json', 'vscode/icon.png', 'vscode/extension.js', 'vscode/.vscodeignore',
    'vscode/lsp/flow-language-server.js', 'vscode/fmt/index.js', 'vscode/language-configuration.json',
    'vscode/syntaxes/flow.tmLanguage.json', 'vscode/snippets/flow.code-snippets', 'vscode/test/extension.test.js',
    '.zed/snippets/nexss-flow.json',
    'notepadpp/flow-udl.xml', 'notepadpp/README.md', 'notepadpp/nexss-logo.png',
    'notepadpp/fmt/cli.js', 'notepadpp/fmt/index.js',
    'notepadpp/flowfmt.cmd', 'notepadpp/nppexec/Format-Flow.npes',
    'claude/.claude-plugin/plugin.json', 'claude/.lsp.json', 'claude/commands/flowfmt.md',
    'claude/lsp/flow-language-server.js', 'claude/fmt/index.js', 'claude/fmt/cli.js', 'claude/README.md',
    'jetbrains/textmate/nexss-flow.tmLanguage.json', 'jetbrains/README.md',
    'jetbrains/fmt/cli.js', 'jetbrains/fmt/index.js',
    '.github/workflows/release.yml',
]
for rel in required:
    path = ROOT / rel
    assert path.is_file() and path.stat().st_size > 0, f'missing or empty: {rel}'

# Parse structured metadata, including snippets and generated Tree-sitter node metadata.
for path in ROOT.rglob('*.json'):
    if 'target' in path.parts or 'node_modules' in path.parts:
        continue
    json.loads(path.read_text(encoding='utf-8'))
for rel in ['zed/extension.toml', 'zed/languages/flow/config.toml',
            'zed-legacy-0.230.2/extension.toml', 'zed-legacy-0.230.2/languages/flow/config.toml',
            'zed/Cargo.toml', 'zed-legacy-0.230.2/Cargo.toml']:
    tomllib.loads((ROOT / rel).read_text(encoding='utf-8'))
ET.parse(ROOT / 'notepadpp/flow-udl.xml')

vscode = json.loads((ROOT / 'vscode/package.json').read_text())
claude_plugin = json.loads((ROOT / 'claude/.claude-plugin/plugin.json').read_text())
claude_lsp = json.loads((ROOT / 'claude/.lsp.json').read_text())
tm = json.loads((ROOT / 'vscode/syntaxes/flow.tmLanguage.json').read_text())
jetbrains_tm = json.loads((ROOT / 'jetbrains/textmate/nexss-flow.tmLanguage.json').read_text())
vscode_snippets = json.loads((ROOT / 'vscode/snippets/flow.code-snippets').read_text())
zed_snippets = json.loads((ROOT / '.zed/snippets/nexss-flow.json').read_text())
assert vscode['main'] == './extension.js' and vscode['publisher'] == 'nexssp'
assert vscode['contributes']['languages'][0]['extensions'] == ['.nflow']
assert vscode['contributes']['languages'][0]['id'] == 'nexss-flow'
assert vscode['contributes']['grammars'][0]['scopeName'] == 'source.nflow'
assert vscode['contributes']['configuration']['properties']['nexssFlow.languageServer.command']['default'] == ''
assert 'nexssFlow.languageServer.args' in vscode['contributes']['configuration']['properties']
assert tm['scopeName'] == 'source.nflow' and tm['fileTypes'] == ['nflow']
assert jetbrains_tm == tm, 'JetBrains TextMate grammar must match the VS Code source grammar'
assert claude_plugin['name'] == 'nexss-flow'
assert claude_lsp['nexss-flow']['extensionToLanguage'] == {'.nflow': 'nexss-flow'}
required_assert_snippets = {'flow-assert-expression', 'flow-assert-inline', 'flow-assert-call'}
assert required_assert_snippets <= {snippet['prefix'] for snippet in vscode_snippets.values()}
assert required_assert_snippets <= set(zed_snippets)

for rel in ['zed/languages/flow/config.toml', 'zed-legacy-0.230.2/languages/flow/config.toml']:
    language = tomllib.loads((ROOT / rel).read_text())
    assert language['name'] == 'Nexss Flow' and language['grammar'] == 'flow'
    assert language['path_suffixes'] == ['nflow']
    assert language['line_comments'] == ['//']
for rel in ['zed/extension.toml', 'zed-legacy-0.230.2/extension.toml']:
    manifest = tomllib.loads((ROOT / rel).read_text())
    assert manifest['grammars']['flow']['repository'] == 'https://github.com/nexssp/flow-editor-support'
    assert manifest['grammars']['flow']['rev'] == 'main'
    assert manifest['language_servers']['nexss-flow-language-server']['languages'] == ['Nexss Flow']

udl = ET.parse(ROOT / 'notepadpp/flow-udl.xml').getroot()
user_lang = udl.find('UserLang')
assert user_lang is not None and user_lang.attrib['ext'] == 'nflow'
comments = user_lang.find("./KeywordLists/Keywords[@name='Comments']")
assert comments is not None and comments.text.strip().startswith('00//')
np_exec = (ROOT / 'notepadpp/nppexec/Format-Flow.npes').read_text()
assert 'flowfmt.cmd' in np_exec and 'NPP_SAVE' in np_exec and 'NPP_OPEN' in np_exec
cmd = (ROOT / 'notepadpp/flowfmt.cmd').read_text()
assert '%~dp0..' in cmd and 'fmt\\cli.js' in cmd

# Editor packages carry byte-identical LSP and formatter implementations.
lsp_source = (ROOT / 'lsp/flow-language-server.js').read_bytes()
for rel in ['vscode/lsp/flow-language-server.js', 'zed/lsp/flow-language-server.js',
            'zed-legacy-0.230.2/lsp/flow-language-server.js', 'claude/lsp/flow-language-server.js']:
    assert (ROOT / rel).read_bytes() == lsp_source, f'stale LSP copy: {rel}'
fmt_source = (ROOT / 'fmt/index.js').read_bytes()
for rel in ['vscode/fmt/index.js', 'zed/fmt/index.js', 'zed-legacy-0.230.2/fmt/index.js', 'claude/fmt/index.js']:
    assert (ROOT / rel).read_bytes() == fmt_source, f'stale formatter copy: {rel}'
assert (ROOT / 'claude/fmt/cli.js').read_bytes() == (ROOT / 'fmt/cli.js').read_bytes()
for editor in ['notepadpp', 'jetbrains']:
    assert (ROOT / f'{editor}/fmt/cli.js').read_bytes() == (ROOT / 'fmt/cli.js').read_bytes()
    assert (ROOT / f'{editor}/fmt/index.js').read_bytes() == fmt_source
for rel in ['zed/grammars/flow.js', 'zed-legacy-0.230.2/grammar.js', 'zed-legacy-0.230.2/grammars/flow.js']:
    assert (ROOT / rel).read_bytes() == (ROOT / 'grammar.js').read_bytes(), f'stale grammar copy: {rel}'
assert (ROOT / 'zed/src/flow_extension.rs').read_bytes() == (ROOT / 'zed-legacy-0.230.2/src/flow_extension.rs').read_bytes()
for rel in ['zed-legacy-0.230.2/languages/flow/highlights.scm', 'zed-legacy-0.230.2/languages/flow/brackets.scm']:
    counterpart = rel.replace('zed-legacy-0.230.2/', 'zed/')
    assert (ROOT / rel).read_bytes() == (ROOT / counterpart).read_bytes(), f'stale Zed query: {rel}'

extension = (ROOT / 'vscode/extension.js').read_text()
assert "require('vscode')" in extension
assert 'registerCompletionItemProvider' in extension and 'registerHoverProvider' in extension
assert 'registerDocumentFormattingEditProvider' in extension
assert "configured.split(/\\s+/)" not in extension
assert "server.on('error'" in extension
assert 'languageServer.args' in extension

zed_rust = (ROOT / 'zed/src/flow_extension.rs').read_text()
assert 'env::current_dir()' in zed_rust and 'join("lsp")' in zed_rust
assert 'zed::node_binary_path()' in zed_rust and 'worktree.shell_env()' in zed_rust
assert 'server_path.to_string_lossy()' in zed_rust

lsp = (ROOT / 'lsp/flow-language-server.js').read_text()
for token in ['initialize', 'textDocument/completion', 'textDocument/hover', 'textDocument/formatting',
              'textDocument/didOpen', 'Content-Length', 'UTF-16', 'flow-assert-expression',
              'flow-assert-inline', 'flow-assert-call']:
    assert token in lsp, f'LSP stub lacks {token}'
assert 'documentFormattingProvider' in lsp and 'insertTextFormat: 2' in lsp

fmt = (ROOT / 'fmt/index.js').read_text()
assert 'multilineQuote' in fmt and 'ternaryColonOffsets' in fmt
assert 'normalizeAssertDirective' in fmt and "indentWidth: 2" in fmt
assert 'insertSpaces' not in fmt, 'formatter style must not vary by editor settings'
assert 'replace(/[ \\t]+$/gm' not in fmt, 'must not strip whitespace inside multiline strings'
cli = (ROOT / 'fmt/cli.js').read_text()
assert 'printWidth' not in fmt and all(option not in cli for option in ['--print-width', '--indent-width', '--no-blank-lines'])
tooling = json.loads((ROOT / 'package.json').read_text())
assert tooling['bin']['flowfmt'] == './fmt/cli.js'
assert 'test/fixtures/current-syntax.nflow' in tooling['scripts']['format:check']

highlights = (ROOT / 'zed/languages/flow/highlights.scm').read_text()
for token in ['@operator', '@function', '@property', '@keyword.control', '@string', '@number', '(array "["']:
    assert token in highlights, f'Zed highlight query lacks {token}'
brackets = (ROOT / 'zed/languages/flow/brackets.scm').read_text()
assert '"[" @open "]" @close' in brackets

example = (ROOT / 'examples/complete.nflow').read_text()
assert '@pipeline' in example and '@assert' in example and '@end' in example
assert '@{' in example and '.nflow' in example
fixture = (ROOT / 'test/fixtures/current-syntax.nflow').read_text()
for token in ['parallel', 'race', 'match', 'loop(', 'until(', '@{', 'schema', '#', '~', '`',
              '@assert:', '@assert {', 'assert(']:
    assert token in fixture, f'current-syntax fixture lacks {token}'

release = (ROOT / 'scripts/package-release.sh').read_text()
assert 'mktemp -d' in release and 'Refusing to use an unsafe release output directory' in release
assert 'rm -rf -- "$STAGE"' in release and 'rm -rf -- "$OUT_DIR"' not in release
assert 'nexss-flow-claude-code.zip' in release and 'nexss-flow-jetbrains.zip' in release
workflow = (ROOT / '.github/workflows/release.yml').read_text()
assert 'package-release.sh' in workflow and 'softprops/action-gh-release' in workflow

readme = (ROOT / 'README.md').read_text()
for editor in ['VS Code', 'Zed', 'Notepad++', 'JetBrains', 'Claude Code']:
    assert editor in readme, f'root README lacks {editor} integration documentation'
assert 'Flow v0.42.0' in readme and 'Go-fmt-style formatter' in readme
print(f'validated {len(required)} required files; suffixes, manifests, grammar/LSP/formatter copies, and package safety=OK')
