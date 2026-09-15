#!/usr/bin/env python3
"""Dependency-free smoke tests for the Nexss Flow editor-support bundle."""
from pathlib import Path
import json, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
required = [
    'README.md', 'LICENSE', 'package.json', 'examples/complete.flow', 'fmt/index.js', 'fmt/cli.js',
    'fmt/test/formatter.test.js', 'fmt/test/fixtures/pipeline.flow', 'fmt/test/fixtures/pipeline.expected.flow',
    'zed/extension.toml', 'zed/grammars/flow.js', 'zed/languages/flow/config.toml',
    'zed/languages/flow/highlights.scm', 'zed/languages/flow/brackets.scm',
    'zed/lsp/flow-language-server.js', 'zed/lsp/nexss-flow-language-server', 'zed/fmt/index.js',
    'vscode/package.json', 'vscode/extension.js', 'vscode/lsp/flow-language-server.js', 'vscode/fmt/index.js', 'vscode/language-configuration.json', 'vscode/syntaxes/flow.tmLanguage.json',
    'vscode/snippets/flow.code-snippets', '.zed/snippets/nexss-flow.json',
    'notepadpp/flow-udl.xml', 'notepadpp/README.md', 'notepadpp/flowfmt.cmd', 'notepadpp/nppexec/Format-Flow.npes',
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
tm = json.load(open(ROOT/'vscode/syntaxes/flow.tmLanguage.json'))
assert tm['scopeName'] == 'source.flow'
ET.parse(ROOT/'notepadpp/flow-udl.xml')
package = json.load(open(ROOT/'vscode/package.json'))
assert any(x.get('path') == './snippets/flow.code-snippets' for x in package['contributes']['snippets'])
assert package.get('main') == './extension.js'
assert package['contributes']['configuration']['properties']['nexssFlow.languageServer.command']['default'] == ''
assert 'language_servers' in (ROOT/'zed/languages/flow/config.toml').read_text()
assert 'line_comments = ["//"]' in (ROOT/'zed/languages/flow/config.toml').read_text()
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
assert 'path = "zed/grammars/flow.js"' in zed_extension
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
assert 'line_comments = ["//"]' in (ROOT/'zed/extension.toml').read_text()
assert 'const vscode = require(\'vscode\')' in (ROOT/'vscode/extension.js').read_text()
extension = (ROOT/'vscode/extension.js').read_text()
assert 'parts = configured ? configured.split' in extension
assert 'registerHoverProvider' in extension
assert 'registerDocumentFormattingEditProvider' in extension
assert (ROOT/'lsp/flow-language-server.js').read_bytes() == (ROOT/'vscode/lsp/flow-language-server.js').read_bytes()
assert (ROOT/'lsp/flow-language-server.js').read_bytes() == (ROOT/'zed/lsp/flow-language-server.js').read_bytes()
assert (ROOT/'fmt/index.js').read_bytes() == (ROOT/'vscode/fmt/index.js').read_bytes() == (ROOT/'zed/fmt/index.js').read_bytes()
assert 'documentFormattingProvider' in lsp
assert 'textDocument/formatting' in lsp and 'textDocument/didOpen' in lsp
assert 'command = "lsp/nexss-flow-language-server"' in zed_extension
zed_wrapper = (ROOT/'zed/lsp/nexss-flow-language-server').read_text()
assert zed_wrapper.startswith('#!/usr/bin/env sh') and 'flow-language-server.js' in zed_wrapper
assert tm['repository']['comments']['patterns'][0]['match'] == r'^(\s*)//.*$'
assert not example.startswith('#')
assert 'Version 2.0' in (ROOT/'LICENSE').read_text() and len((ROOT/'LICENSE').read_text()) > 10000
print(f'validated {len(required)} files; TextMate scope={tm["scopeName"]}; snippets/LSP/CI=OK')
