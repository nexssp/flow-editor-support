#!/usr/bin/env python3
"""Consistency and architecture checks for Nexss Flow editor integrations."""
from pathlib import Path
import json
import tomllib
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
required = [
    'README.md', 'LICENSE', 'package.json', 'package-lock.json', 'grammar.js', 'src/parser.c', 'src/node-types.json', 'src/scanner.c',
    'assets/nexss-logo.png', 'examples/complete.nflow', 'test/fixtures/current-syntax.nflow',
    'test/fixtures/template-render-input.nflow', 'test/fixtures/template-render-expected.nflow',
    'test/fixtures/template-render-contexts.nflow', 'test/fixtures/python-inline.nflow',
    'test/fixtures/embedded-languages.nflow', 'test/template-textmate.test.js', 'test/nflow-lsp.test.js',
    'test/zed-adapter-smoke.test.js', 'test/helpers/process-tree.js', 'test/process-tree.test.js',
    'fmt/index.js', 'fmt/cli.js', 'fmt/test/helpers.js', 'fmt/test/formatter.test.js',
    'fmt/test/core-integration.test.js', 'fmt/test/real-core-lsp.test.js', 'fmt/test/template-render-core.test.js',
    'fmt/test/fixtures/pipeline.nflow', 'fmt/test/fixtures/pipeline.expected.nflow',
    'lsp/nflow-lsp.js', 'lsp/nexss-flow-language-server', 'scripts/validate.py', 'scripts/check-grammar.sh',
    'scripts/package-release.sh', 'scripts/install-flow-core.sh',
    'zed/extension.toml', 'zed/grammars/flow.js', 'zed/languages/flow/config.toml',
    'zed/languages/flow/highlights.scm', 'zed/languages/flow/brackets.scm', 'zed/lsp/nflow-lsp.js',
    'zed/lsp/nexss-flow-language-server', 'zed/language-servers/nexss-flow-language-server.toml',
    'zed/fmt/index.js', 'zed/logo.png', 'zed/Cargo.toml', 'zed/src/flow_extension.rs',
    'zed-legacy-0.230.2/extension.toml', 'zed-legacy-0.230.2/languages/flow/config.toml',
    'zed-legacy-0.230.2/languages/flow/highlights.scm', 'zed-legacy-0.230.2/languages/flow/brackets.scm',
    'zed-legacy-0.230.2/grammar.js', 'zed-legacy-0.230.2/grammars/flow.js',
    'zed-legacy-0.230.2/lsp/nflow-lsp.js', 'zed-legacy-0.230.2/lsp/nexss-flow-language-server',
    'zed-legacy-0.230.2/language-servers/nexss-flow-language-server.toml',
    'zed-legacy-0.230.2/fmt/index.js', 'zed-legacy-0.230.2/logo.png',
    'zed-legacy-0.230.2/Cargo.toml', 'zed-legacy-0.230.2/src/flow_extension.rs',
    'vscode/package.json', 'vscode/package-lock.json', 'vscode/icon.png', 'vscode/extension.js',
    'vscode/.vscodeignore', 'vscode/lsp/nflow-lsp.js', 'vscode/fmt/index.js',
    'vscode/language-configuration.json', 'vscode/syntaxes/flow.tmLanguage.json',
    'vscode/snippets/flow.code-snippets', 'vscode/test/extension.test.js',
    'vscode/test/adapter-smoke.test.js', 'vscode/test/real-core.test.js',
    '.zed/snippets/nexss-flow.json', 'notepadpp/flow-udl.xml', 'notepadpp/README.md', 'notepadpp/nexss-logo.png',
    'notepadpp/fmt/cli.js', 'notepadpp/fmt/index.js', 'notepadpp/flowfmt.cmd',
    'notepadpp/nppexec/Format-Flow.npes', 'claude/.claude-plugin/plugin.json', 'claude/.lsp.json',
    'claude/commands/flowfmt.md', 'claude/lsp/nflow-lsp.js', 'claude/fmt/index.js', 'claude/fmt/cli.js',
    'claude/README.md', 'jetbrains/textmate/nexss-flow.tmLanguage.json', 'jetbrains/README.md',
    'jetbrains/fmt/cli.js', 'jetbrains/fmt/index.js', '.github/workflows/release.yml',
]
for rel in required:
    path = ROOT / rel
    assert path.is_file() and path.stat().st_size > 0, f'missing or empty: {rel}'

removed = [
    'lsp/flow-language-server.js', 'vscode/lsp/flow-language-server.js', 'zed/lsp/flow-language-server.js',
    'zed-legacy-0.230.2/lsp/flow-language-server.js', 'claude/lsp/flow-language-server.js',
    'fmt/test/lsp.test.js',
]
for rel in removed:
    assert not (ROOT / rel).exists(), f'obsolete bridge/test must be removed: {rel}'

for path in ROOT.rglob('*.json'):
    if 'target' in path.parts or 'node_modules' in path.parts:
        continue
    json.loads(path.read_text(encoding='utf-8'))
for rel in [
    'zed/extension.toml', 'zed/languages/flow/config.toml',
    'zed-legacy-0.230.2/extension.toml', 'zed-legacy-0.230.2/languages/flow/config.toml',
    'zed/Cargo.toml', 'zed-legacy-0.230.2/Cargo.toml',
    'zed/language-servers/nexss-flow-language-server.toml',
    'zed-legacy-0.230.2/language-servers/nexss-flow-language-server.toml',
]:
    tomllib.loads((ROOT / rel).read_text(encoding='utf-8'))
ET.parse(ROOT / 'notepadpp/flow-udl.xml')

vscode = json.loads((ROOT / 'vscode/package.json').read_text())
vscode_lock = json.loads((ROOT / 'vscode/package-lock.json').read_text())
claude_plugin = json.loads((ROOT / 'claude/.claude-plugin/plugin.json').read_text())
claude_lsp = json.loads((ROOT / 'claude/.lsp.json').read_text())
tm = json.loads((ROOT / 'vscode/syntaxes/flow.tmLanguage.json').read_text())
jetbrains_tm = json.loads((ROOT / 'jetbrains/textmate/nexss-flow.tmLanguage.json').read_text())
vscode_snippets = json.loads((ROOT / 'vscode/snippets/flow.code-snippets').read_text())
zed_snippets = json.loads((ROOT / '.zed/snippets/nexss-flow.json').read_text())
assert vscode['main'] == './extension.js' and vscode['publisher'] == 'nexssp'
assert vscode['engines']['vscode'] == '>=1.82.0'
assert vscode['dependencies']['vscode-languageclient'] == '9.0.1'
assert vscode_lock['packages']['node_modules/vscode-languageclient']['version'] == '9.0.1'
assert vscode['contributes']['languages'][0]['extensions'] == ['.nflow']
assert vscode['contributes']['languages'][0]['id'] == 'nexss-flow'
assert vscode['contributes']['grammars'][0]['scopeName'] == 'source.nflow'
embedded_languages = vscode['contributes']['grammars'][0]['embeddedLanguages']
expected_embedded_languages = {
    'meta.embedded.block.python.nflow': 'python',
    'meta.embedded.inline.python.nflow': 'python',
}
for language in ['rust', 'php', 'typescript', 'javascript', 'go']:
    expected_embedded_languages[f'meta.embedded.block.{language}.nflow'] = language
    expected_embedded_languages[f'meta.embedded.inline.{language}.nflow'] = language
assert embedded_languages == expected_embedded_languages
properties = vscode['contributes']['configuration']['properties']
assert properties['nexssFlow.nflowCommand']['default'] == ''
assert 'v0.44.2 or newer' in properties['nexssFlow.nflowCommand']['description']
assert properties['nexssFlow.languageServer.command']['default'] == ''
assert 'bypasses the core version check' in properties['nexssFlow.languageServer.command']['description']
assert 'nexssFlow.languageServer.args' in properties
assert 'node_modules/' not in (ROOT / 'vscode/.vscodeignore').read_text()
assert tm['scopeName'] == 'source.nflow' and tm['fileTypes'] == ['nflow']
for grammar_rule in ['templateRender', 'templateRenderStringDouble', 'goTemplate', 'pythonInline', 'pythonBlock', 'pythonNestedBlock',
                     'rustInline', 'rustBlock', 'rustNestedBlock', 'phpInline', 'phpBlock', 'phpNestedBlock',
                     'typescriptInline', 'typescriptBlock', 'typescriptNestedBlock',
                     'javascriptInline', 'javascriptBlock', 'javascriptNestedBlock',
                     'goInline', 'goBlock', 'goNestedBlock']:
    assert grammar_rule in tm['repository'], f'TextMate grammar lacks {grammar_rule}'
grammar_source = (ROOT / 'grammar.js').read_text()
for token in ['language_inline:', 'language_block:', 'language_block_content', 'rust_language_block_content', 'language_inline_double_content',
              'language_inline_single_content', 'language_inline_backtick_content']:
    assert token in grammar_source, f'Tree-sitter grammar lacks {token}'
for language_tag in ['rust', 'rs', 'php', 'typescript', 'ts', 'javascript', 'js', 'go', 'golang']:
    assert f"'{language_tag}'" in grammar_source, f'Tree-sitter grammar lacks {language_tag} language blocks'
python_rules = json.dumps({key: tm['repository'][key] for key in ['pythonInline', 'pythonBlock', 'pythonNestedBlock']})
assert 'source.python' in python_rules, 'TextMate grammar must reuse the editor Python grammar'
go_template_rules = json.dumps(tm['repository']['goTemplate'])
for scope in ['keyword.control.go-template', 'variable.other.go-template',
              'variable.language.go-template', 'punctuation.section.embedded.begin.go-template']:
    assert scope in go_template_rules, f'TextMate grammar lacks {scope}'
assert jetbrains_tm == tm, 'JetBrains TextMate grammar must match the VS Code source grammar'
assert claude_plugin['name'] == 'nexss-flow'
assert claude_lsp['nexss-flow']['extensionToLanguage'] == {'.nflow': 'nexss-flow'}
assert claude_lsp['nexss-flow']['command'] == 'node'
assert claude_lsp['nexss-flow']['args'] == ['${CLAUDE_PLUGIN_ROOT}/lsp/nflow-lsp.js']
required_assert_snippets = {'flow-assert-expression', 'flow-assert-inline', 'flow-assert-call'}
assert required_assert_snippets <= {snippet['prefix'] for snippet in vscode_snippets.values()}
assert required_assert_snippets <= set(zed_snippets)

vscode_by_prefix = {snippet['prefix']: snippet for snippet in vscode_snippets.values()}
for prefix in ['flow-node', 'flow-pipeline']:
    assert prefix in vscode_by_prefix and prefix in zed_snippets
assert ' :timeout=' in ' '.join(vscode_by_prefix['flow-node']['body'])
assert ' :timeout=' in ' '.join(zed_snippets['flow-node']['body'])
for body in [vscode_by_prefix['flow-pipeline']['body'], zed_snippets['flow-pipeline']['body']]:
    rendered = '\n'.join(body)
    assert '  :timeout=10s\n  :retry=2\n\n' in rendered

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
for rel in ['zed/language-servers/nexss-flow-language-server.toml',
            'zed-legacy-0.230.2/language-servers/nexss-flow-language-server.toml']:
    metadata = tomllib.loads((ROOT / rel).read_text())
    assert metadata['name'] == 'nexss-flow-language-server'
    assert 'nflow-lsp' in metadata['command'] or metadata['command'].endswith('nexss-flow-language-server')

udl = ET.parse(ROOT / 'notepadpp/flow-udl.xml').getroot()
user_lang = udl.find('UserLang')
assert user_lang is not None and user_lang.attrib['ext'] == 'nflow'
comments = user_lang.find("./KeywordLists/Keywords[@name='Comments']")
assert comments is not None and comments.text.strip().startswith('00//')
np_exec = (ROOT / 'notepadpp/nppexec/Format-Flow.npes').read_text()
assert 'flowfmt.cmd' in np_exec and 'NPP_SAVE' in np_exec and 'NPP_OPEN' in np_exec
cmd = (ROOT / 'notepadpp/flowfmt.cmd').read_text()
assert 'fmt --write' in cmd and 'NFLOW_BIN' in cmd and 'fmt\\cli.js' not in cmd
claude_command = (ROOT / 'claude/commands/flowfmt.md').read_text()
assert 'fmt/cli.js" --write' in claude_command and 'NFLOW_BIN' in claude_command
assert 'v0.44.2 or newer' in claude_command
assert 'File Watcher' in (ROOT / 'jetbrains/README.md').read_text()
assert 'fmt --write' in (ROOT / 'jetbrains/README.md').read_text()
assert 'nflow lint' in (ROOT / 'jetbrains/README.md').read_text()
assert 'nflow fmt' in (ROOT / 'notepadpp/README.md').read_text()
assert 'nflow lint' in (ROOT / 'notepadpp/README.md').read_text()

# A launcher may be copied into installable editor bundles, but it must stay a
# byte-identical, protocol-transparent wrapper around Flow core's native LSP.
launcher = (ROOT / 'lsp/nflow-lsp.js').read_bytes()
for rel in ['vscode/lsp/nflow-lsp.js', 'zed/lsp/nflow-lsp.js',
            'zed-legacy-0.230.2/lsp/nflow-lsp.js', 'claude/lsp/nflow-lsp.js']:
    assert (ROOT / rel).read_bytes() == launcher, f'stale native LSP launcher copy: {rel}'
source = launcher.decode('utf-8')
for token in ['MINIMUM_VERSION = [0, 44, 2]', "['lsp']", "['--version']", 'stdio: \'inherit\'', 'NFLOW_BIN']:
    assert token in source, f'native launcher lacks {token}'
for token in ['textDocument/', 'publishDiagnostics', 'JSON.stringify', 'formatter', 'completionItems']:
    assert token not in source, f'launcher must not implement LSP features: {token}'

fmt_adapter = (ROOT / 'fmt/index.js').read_bytes()
for rel in ['vscode/fmt/index.js', 'zed/fmt/index.js', 'zed-legacy-0.230.2/fmt/index.js',
            'claude/fmt/index.js', 'notepadpp/fmt/index.js', 'jetbrains/fmt/index.js']:
    assert (ROOT / rel).read_bytes() == fmt_adapter, f'stale nflow formatter adapter copy: {rel}'
assert (ROOT / 'claude/fmt/cli.js').read_bytes() == (ROOT / 'fmt/cli.js').read_bytes()
for editor in ['notepadpp', 'jetbrains']:
    assert (ROOT / f'{editor}/fmt/cli.js').read_bytes() == (ROOT / 'fmt/cli.js').read_bytes()
for rel in ['zed/grammars/flow.js', 'zed-legacy-0.230.2/grammar.js', 'zed-legacy-0.230.2/grammars/flow.js']:
    assert (ROOT / rel).read_bytes() == (ROOT / 'grammar.js').read_bytes(), f'stale grammar copy: {rel}'
assert (ROOT / 'zed/src/flow_extension.rs').read_bytes() == (ROOT / 'zed-legacy-0.230.2/src/flow_extension.rs').read_bytes()
for rel in ['zed-legacy-0.230.2/languages/flow/highlights.scm', 'zed-legacy-0.230.2/languages/flow/brackets.scm']:
    counterpart = rel.replace('zed-legacy-0.230.2/', 'zed/')
    assert (ROOT / rel).read_bytes() == (ROOT / counterpart).read_bytes(), f'stale Zed query: {rel}'
for rel in ['zed/src/flow_extension.rs', 'zed-legacy-0.230.2/src/flow_extension.rs']:
    rust = (ROOT / rel).read_text()
    assert 'join("lsp").join("nflow-lsp.js")' in rust
    assert 'zed::node_binary_path()' in rust and 'worktree.shell_env()' in rust
for rel in ['lsp/nexss-flow-language-server', 'zed/lsp/nexss-flow-language-server',
            'zed-legacy-0.230.2/lsp/nexss-flow-language-server']:
    assert 'nflow-lsp.js' in (ROOT / rel).read_text()

extension = (ROOT / 'vscode/extension.js').read_text()
assert "require('vscode')" in extension and "require('vscode-languageclient/node')" in extension
assert 'new LanguageClient(' in extension and 'client.start()' in extension and 'activeClient.stop()' in extension
assert "languageServer.command" in extension and "languageServer.args" in extension
assert 'NFLOW_BIN = nflowCommand' in extension
for old_provider in ['registerCompletionItemProvider', 'registerHoverProvider', 'registerDocumentFormattingEditProvider']:
    assert old_provider not in extension, f'VS Code must use core LSP, not local provider {old_provider}'

fmt = (ROOT / 'fmt/index.js').read_text()
assert "spawnSync(executable, ['fmt', ...args]" in fmt
assert "runNflow(['--stdin']" in fmt and 'NFLOW_BIN' in fmt
for old_rule in ['ternaryColonOffsets', 'normalizeCode', 'normalizeAssertDirective', 'indentWidth', 'maxBlankLines']:
    assert old_rule not in fmt, f'adapter must not own formatting rule: {old_rule}'
cli = (ROOT / 'fmt/cli.js').read_text()
assert "spawnSync(executable, ['fmt', ...process.argv.slice(2)]" in cli and "stdio: 'inherit'" in cli
assert json.loads((ROOT / 'package.json').read_text())['bin']['flowfmt'] == './fmt/cli.js'

highlights = (ROOT / 'zed/languages/flow/highlights.scm').read_text()
for token in ['@operator', '@function', '@property', '@keyword.control', '@string', '@number', '(array "["']:
    assert token in highlights, f'Zed highlight query lacks {token}'
for token in ['(template_keyword) @keyword.control', '(template_variable) @variable.member',
              '(template_dot) @variable.builtin', '(template_action_open) @punctuation.special']:
    assert token in highlights, f'Zed query lacks template scope {token}'
for token in ['(language_block_content) @injection.content', '(rust_language_block_content) @injection.content', '(#set! injection.language "python")']:
    assert token in highlights, f'Zed query lacks embedded Python scope {token}'
for language in ['rust', 'php', 'typescript', 'javascript', 'go']:
    assert f'(#set! injection.language "{language}")' in highlights, f'Zed query lacks {language} injection'
brackets = (ROOT / 'zed/languages/flow/brackets.scm').read_text()
assert '"[" @open "]" @close' in brackets

example = (ROOT / 'examples/complete.nflow').read_text()
assert '@pipeline' in example and '@assert' in example and '@end' in example
assert '@{' in example and '.nflow' in example
fixture = (ROOT / 'test/fixtures/current-syntax.nflow').read_text()
for token in ['@nflow_version', 'parallel', 'race', 'match', 'loop(', 'until(', '@{', 'schema', '#', '~', '`',
              '@assert:', '@assert {', 'assert(']:
    assert token in fixture, f'current-syntax fixture lacks {token}'
python_fixture = (ROOT / 'test/fixtures/python-inline.nflow').read_text()
for token in ['@require lang', 'py {', 'import json', 'py.file',
              "'greater_than>'", "'a, ) : &'"]:
    assert token in python_fixture, f'Python highlighting fixture lacks {token}'
embedded_fixture = (ROOT / 'test/fixtures/embedded-languages.nflow').read_text()
for token in ['rust {', 'php {', 'typescript {', 'javascript {', 'go {', 'rs"', "php'", 'ts`', 'js"', "go'", 'golang`']:
    assert token in embedded_fixture, f'Embedded-language highlighting fixture lacks {token}'

release = (ROOT / 'scripts/package-release.sh').read_text()
assert 'mktemp -d' in release and 'Refusing to use an unsafe release output directory' in release
assert 'rm -rf -- "$STAGE"' in release and 'rm -rf -- "$OUT_DIR"' not in release
assert 'nexss-flow-claude-code.zip' in release and 'nexss-flow-jetbrains.zip' in release
assert 'install-flow-core.sh" --check' in release
assert 'lsp/nflow-lsp.js' in release and 'vscode/lsp/nflow-lsp.js' in release
assert 'npm ci --omit=dev' in release and '--no-dependencies' not in release
workflow = (ROOT / '.github/workflows/release.yml').read_text()
assert 'package-release.sh' in workflow and 'softprops/action-gh-release' in workflow
assert 'run: npm ci' in workflow
assert workflow.count('install-flow-core.sh install') == 2
assert 'bash scripts/install-flow-core.sh install >/dev/null' in workflow
assert 'nflow-v0.' not in workflow and 'node --check lsp/nflow-lsp.js' in workflow
core_installer = (ROOT / 'scripts/install-flow-core.sh').read_text()
assert 'VERSION=0.52.0' in core_installer and 'MINIMUM_VERSION=0.44.2' in core_installer
assert 'actual_patch < 2' in core_installer
assert 'nflow-v${VERSION}' in core_installer
real_core_lsp_test = (ROOT / 'fmt/test/real-core-lsp.test.js').read_text()
assert 'FLOW_NFLOW_PATCHED_BIN' not in real_core_lsp_test
assert 'if (TEST_TEMPLATE_FIX)' not in real_core_lsp_test
assert 'templateFormatted.result[0].newText, TEMPLATE_EXPECTED' in real_core_lsp_test
assert 'EXPECTED_MANIFEST_SHA256=8d04191a3ca487996f8580ee082014da95909671b933e5d0cee15bec4c8967ef' in core_installer
for variable in ['NFLOW_BIN', 'FLOW_NFLOW_BIN', 'FLOW_NFLOW_LSP_BIN']:
    assert f'printf \'{variable}=%s\\n\'' in core_installer

readme = (ROOT / 'README.md').read_text()
assert readme.splitlines()[:2] == ['# Nexss Flow editor support', '<small>Nexss Flow 🌀 ready</small>']
for editor in ['VS Code', 'Zed', 'Notepad++', 'JetBrains', 'Claude Code']:
    assert editor in readme, f'root README lacks {editor} integration documentation'
for token in ['Nexss Flow', 'nflow', 'Available LSP features depend on the installed Nexss Flow version.',
              'NFLOW_BIN', 'nflow --version', 'nflow lint', 'nflow fmt']:
    assert token in readme, f'root README lacks {token}'
assert 'v0.44.2' not in readme and 'v0.52.0' not in readme
for rel, tokens in [
    ('vscode/test/adapter-smoke.test.js', [
        'textDocument/definition', 'textDocument/references', 'textDocument/rename',
        'textDocument/documentSymbol', 'workspace/symbol', 'textDocument/foldingRange',
        'textDocument/semanticTokens/full', 'textDocument/codeAction',
    ]),
    ('test/zed-adapter-smoke.test.js', ['textDocument/documentSymbol']),
]:
    smoke = (ROOT / rel).read_text()
    for token in tokens:
        assert token in smoke, f'{rel} lacks real-provider request {token}'
print(f'validated {len(required)} required files; real-core v0.52.0 pin, v0.44.2 compatibility floor, editor docs, and package safety=OK')
