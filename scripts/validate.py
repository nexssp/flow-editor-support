#!/usr/bin/env python3
"""Dependency-free smoke tests for the Nexss Flow editor-support bundle."""
from pathlib import Path
import json, tomllib, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
required = [
    'README.md', 'LICENSE', 'package.json', 'grammar.js', 'src/parser.c', 'src/node-types.json', 'assets/nexss-logo.png', 'examples/complete.flow', 'fmt/index.js', 'fmt/cli.js',
    'fmt/test/formatter.test.js', 'fmt/test/fixtures/pipeline.flow', 'fmt/test/fixtures/pipeline.expected.flow',
    'zed/extension.toml', 'zed/grammars/flow.js', 'zed/languages/flow/config.toml',
    'zed/languages/flow/highlights.scm', 'zed/languages/flow/brackets.scm',
    'zed/lsp/flow-language-server.js', 'zed/lsp/nexss-flow-language-server', 'zed/fmt/index.js', 'zed/logo.png',
    'zed-legacy-0.230.2/extension.toml', 'zed-legacy-0.230.2/lsp/flow-language-server.js', 'zed-legacy-0.230.2/lsp/nexss-flow-language-server', 'zed-legacy-0.230.2/fmt/index.js', 'zed-legacy-0.230.2/logo.png',
    'vscode/package.json', 'vscode/icon.png', 'vscode/extension.js', 'vscode/lsp/flow-language-server.js', 'vscode/fmt/index.js', 'vscode/language-configuration.json', 'vscode/syntaxes/flow.tmLanguage.json',
    'vscode/snippets/flow.code-snippets', '.zed/snippets/nexss-flow.json',
    'notepadpp/flow-udl.xml', 'notepadpp/README.md', 'notepadpp/nexss-logo.png', 'notepadpp/flowfmt.cmd', 'notepadpp/nppexec/Format-Flow.npes',
    'claude/.claude-plugin/plugin.json', 'claude/.lsp.json', 'claude/commands/flowfmt.md', 'claude/lsp/flow-language-server.js', 'claude/fmt/index.js', 'claude/fmt/cli.js', 'claude/README.md',
    'jetbrains/textmate/nexss-flow.tmLanguage.json', 'jetbrains/README.md',
    'lsp/flow-language-server.js', 'lsp/nexss-flow-language-server',
    '.github/workflows/release.yml', 'scripts/package-release.sh',
]
for rel in required:
    p = ROOT / rel
    assert p.is_file() and p.stat().st_size > 0, f'missing or empty: {rel}'
json.load(open(ROOT/'vscode/package.json'))
json.load(open(ROOT/'vscode/language-configuration.json'))
json.load(open(ROOT/'vscode/snippets/flow.code-snippets'))
json.load(open(ROOT/'.zed/snippets/nexss-flow.json'))
claude_plugin = json.load(open(ROOT/'claude/.claude-plugin/plugin.json'))
claude_lsp = json.load(open(ROOT/'claude/.lsp.json'))
json.load(open(ROOT/'jetbrains/textmate/nexss-flow.tmLanguage.json'))
tm = json.load(open(ROOT/'vscode/syntaxes/flow.tmLanguage.json'))
assert tm['scopeName'] == 'source.flow'
ET.parse(ROOT/'notepadpp/flow-udl.xml')
package = json.load(open(ROOT/'vscode/package.json'))
assert any(x.get('path') == './snippets/flow.code-snippets' for x in package['contributes']['snippets'])
assert package.get('main') == './extension.js'
assert package.get('icon') == 'icon.png'
assert package.get('publisher') == 'nexssp'
assert package['contributes']['configuration']['properties']['nexssFlow.languageServer.command']['default'] == ''
assert 'language_servers' in (ROOT/'zed/languages/flow/config.toml').read_text()
assert 'line_comments = ["//"]' in (ROOT/'zed/languages/flow/config.toml').read_text()
zed_manifest_data = tomllib.loads((ROOT/'zed/extension.toml').read_text())
zed_language_data = tomllib.loads((ROOT/'zed/languages/flow/config.toml').read_text())
assert 'languages' not in zed_manifest_data
assert zed_manifest_data['language_servers']['nexss-flow-language-server']['languages'] == ['Nexss Flow']
assert zed_language_data['name'] == 'Nexss Flow' and zed_language_data['grammar'] == 'flow'
legacy_manifest_data = tomllib.loads((ROOT/'zed-legacy-0.230.2/extension.toml').read_text())
assert legacy_manifest_data['schema_version'] == 1
assert legacy_manifest_data['capabilities'][0]['kind'] == 'process:exec'
assert legacy_manifest_data['id'] == 'nexss-flow-legacy'
lsp = (ROOT/'lsp/flow-language-server.js').read_text()
for token in ['initialize', 'textDocument/completion', 'textDocument/hover', 'Content-Length']:
    assert token in lsp, f'LSP stub lacks {token}'
workflow = (ROOT/'.github/workflows/release.yml').read_text()
for token in ['validate', 'package-release.sh', 'softprops/action-gh-release', 'Marketplace publishing is intentionally not part']:
    assert token in workflow, f'workflow lacks {token}'
example = (ROOT/'examples/complete.flow').read_text()
for token in ['@config:', '@pipeline', '->', '||', '&', '?', 'loop(', 'until(', '{', '}', ':retry=', '#security', '~slow']:
    assert token in example, f'fixture lacks {token}'
highlights = (ROOT/'zed/languages/flow/highlights.scm').read_text()
for token in ['@operator', '@function', '@property', '@keyword.control', '@string', '@number']:
    assert token in highlights, f'highlight query lacks {token}'
zed_grammar = (ROOT/'zed/grammars/flow.js').read_text()
assert "token(seq('#'" not in zed_grammar, 'Tree-sitter must not consume target selectors as comments'
zed_extension = (ROOT/'zed/extension.toml').read_text()
assert 'path = ' not in zed_extension
assert 'repository = "https://github.com/nexssp/flow-editor-support"' in zed_extension
assert '[language_servers.nexss-flow-language-server]' in zed_extension
assert '("(" @open ")" @close)' in (ROOT/'zed/languages/flow/brackets.scm').read_text()
tm_text = (ROOT/'vscode/syntaxes/flow.tmLanguage.json').read_text()
assert '"match": "^(\\\\s*)' in tm_text
assert 'variable.parameter.exclude.flow' in tm_text
assert '"include": "#atoms"' in tm_text
udl = (ROOT/'notepadpp/flow-udl.xml').read_text()
assert '<Keywords name="Comments">00//' in udl and ' ? ~</Keywords>' in udl
assert 'secrets.' not in workflow
assert 'params.position' in lsp and "'source.node\\n-> target.node'" in lsp
zed_highlights = (ROOT/'zed/languages/flow/highlights.scm').read_text()
assert zed_highlights.index('(identifier) @variable') < zed_highlights.index('(atom (identifier) @function)')
assert zed_highlights.count('(loop "until" @keyword.control)') == 1
assert 'modifier_value' in zed_highlights
assert 'line_comments = ["//"]' in (ROOT/'zed/languages/flow/config.toml').read_text()
assert 'const vscode = require(\'vscode\')' in (ROOT/'vscode/extension.js').read_text()
extension = (ROOT/'vscode/extension.js').read_text()
assert 'parts = configured ? configured.split' in extension
assert 'registerHoverProvider' in extension
assert 'registerDocumentFormattingEditProvider' in extension
assert (ROOT/'lsp/flow-language-server.js').read_bytes() == (ROOT/'vscode/lsp/flow-language-server.js').read_bytes()
assert (ROOT/'lsp/flow-language-server.js').read_bytes() == (ROOT/'zed/lsp/flow-language-server.js').read_bytes()
assert (ROOT/'fmt/index.js').read_bytes() == (ROOT/'vscode/fmt/index.js').read_bytes() == (ROOT/'zed/fmt/index.js').read_bytes()
assert (ROOT/'fmt/index.js').read_bytes() == (ROOT/'zed-legacy-0.230.2/fmt/index.js').read_bytes()
assert (ROOT/'lsp/flow-language-server.js').read_bytes() == (ROOT/'zed-legacy-0.230.2/lsp/flow-language-server.js').read_bytes()
assert (ROOT/'lsp/flow-language-server.js').read_bytes() == (ROOT/'claude/lsp/flow-language-server.js').read_bytes()
assert (ROOT/'fmt/index.js').read_bytes() == (ROOT/'claude/fmt/index.js').read_bytes()
assert claude_plugin['name'] == 'nexss-flow'
assert claude_lsp['nexss-flow']['extensionToLanguage']['.flow'] == 'nexss-flow'
assert (ROOT/'grammar.js').read_bytes() == (ROOT/'zed/grammars/flow.js').read_bytes() == (ROOT/'zed-legacy-0.230.2/grammar.js').read_bytes()
assert (ROOT/'grammar.js').read_bytes() == (ROOT/'zed-legacy-0.230.2/grammars/flow.js').read_bytes()
assert 'documentFormattingProvider' in lsp
assert 'textDocument/formatting' in lsp and 'textDocument/didOpen' in lsp
assert 'command = "lsp/nexss-flow-language-server"' in zed_extension
zed_wrapper = (ROOT/'zed/lsp/nexss-flow-language-server').read_text()
assert zed_wrapper.startswith('#!/usr/bin/env sh') and 'flow-language-server.js' in zed_wrapper
assert tm['repository']['comments']['patterns'][0]['match'] == r'^(\s*)//.*$'
assert not example.startswith('#')
assert 'Version 2.0' in (ROOT/'LICENSE').read_text() and len((ROOT/'LICENSE').read_text()) > 10000
print(f'validated {len(required)} files; TextMate scope={tm["scopeName"]}; snippets/LSP/CI=OK')
