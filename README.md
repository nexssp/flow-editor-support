# Nexss Flow editor support

Editor tooling for Nexss Flow, the workflow language maintained in the [Nexss Flow repository](https://github.com/nexssp/flow). The canonical source format is **`.nflow`**; current language syntax is documented in the [Flow language reference](https://github.com/nexssp/flow/blob/main/docs/language-reference.md).

This package provides syntax highlighting, snippets, a conservative formatter, and a small stdio Language Server Protocol (LSP) server. It is editor assistance, not a replacement for the Flow compiler: the grammar and colorizers do not validate every runtime rule, and the LSP does not provide compiler diagnostics, go-to-definition, or semantic analysis.

The syntax examples and formatter are checked against [Flow v0.42.0](https://github.com/nexssp/flow/releases/tag/v0.42.0), including its single-expression, block, and compact-list `@assert` forms.

## What each editor gets

| Editor | Included support | What it does not provide |
| --- | --- | --- |
| **VS Code** | `.nflow` association, TextMate highlighting, snippets, completion, placeholder hover, and document formatting. The VSIX bundles its own LSP and formatter copies. | No compiler diagnostics or semantic navigation. |
| **Zed** | Tree-sitter highlighting, bracket matching, the shared LSP/formatter, and a Zed-specific extension wrapper. Both current and legacy packages are included. | The grammar is fetched from the Git revision declared in the extension manifest; see the Zed note below. |
| **Notepad++** | User Defined Language profile plus a best-effort NppExec command that runs `flowfmt`. | Notepad++'s UDL profile is colorization only; formatting needs Node.js and the NppExec plugin. |
| **JetBrains IDEs** | TextMate syntax highlighting with `.nflow` file association and an External Tool formatter recipe. | TextMate does not provide native IntelliJ inspections, PSI, or **Reformat Code** integration. |
| **Claude Code** | LSP completion/placeholder hover and the `/flowfmt` command. | Claude Code does not color source files; the host editor handles syntax highlighting. |

## Install and configure

### VS Code

Install `nexss-flow-vscode.vsix` from the release artifacts, or open the `vscode/` folder as the extension project and package it with `@vscode/vsce`. The bundled server starts with the VS Code extension's Node runtime, so the default setup does not need a separate `node` command on `PATH`. `.nflow` files activate the extension automatically.

For format-on-save, add this to VS Code settings:

```json
"[nexss-flow]": {
  "editor.defaultFormatter": "nexssp.nexss-flow-syntax",
  "editor.formatOnSave": true
}
```

A custom compatible stdio LSP can be set with `nexssFlow.languageServer.command` and its separate `nexssFlow.languageServer.args` array. Keeping the executable and argument list separate supports paths containing spaces.

### Zed

Use `nexss-flow-zed.zip` for current Zed versions, or `nexss-flow-zed-legacy-0.230.2.zip` for older Zed 0.230.2. Extract the archive and select the folder containing `extension.toml` in **Install Dev Extension**.

The extension wrapper resolves the bundled `lsp/flow-language-server.js` from the extension directory and uses Zed's Node runtime. To use the LSP formatter on save, set the language formatter to `language_server` and `format_on_save` to `on`; the formatter always uses the same two-space style. The Tree-sitter grammar is a separate repository source: both manifests fetch `https://github.com/nexssp/flow-editor-support` at the configured `main` revision. Consequently, Zed will not see a grammar change made only in a local, unpublished copy; first publish the updated support-repository revision, or use a **local-only** `file://` repository URL while developing. Do not commit a machine-specific `file://` URL. See [Zed's language-extension documentation](https://zed.dev/docs/extensions/languages) and [language settings](https://zed.dev/docs/configuring-languages) for details.

Add this to Zed's `settings.json` to enable format-on-save:

```json
"languages": {
  "Nexss Flow": {
    "formatter": "language_server",
    "format_on_save": "on",
    "tab_size": 2
  }
}
```

### Notepad++

Import `notepadpp/flow-udl.xml` through **Language → Define your language → Import**. If needed, associate the `nflow` suffix with the imported language. The profile treats `//` as the portable comment marker and does not color `#` as a comment, since `#` is also used by Flow selectors and expression predicates.

For formatting, install Node.js and the NppExec plugin. Copy `notepadpp/flowfmt.cmd` to `<Notepad++>\plugins\Config\flowfmt.cmd` and the repository's `fmt/` directory to `<Notepad++>\plugins\fmt\`. Then run `notepadpp/nppexec/Format-Flow.npes` from **Plugins → NppExec → Execute...** and optionally assign a shortcut. The command saves, formats, and reopens the current document.

### JetBrains IDEs

In **Settings/Preferences → Editor → TextMate Bundles**, add `jetbrains/textmate`. The grammar declares the `nflow` file type; associate `*.nflow` manually if your IDE does not do so automatically. To format a file, configure an External Tool or File Watcher to run:

```text
node "<repository>/fmt/cli.js" --write "$FilePath$"
```

This is an external formatter, not native JetBrains formatting support.

### Claude Code

Install the `claude/` folder as a Claude Code plugin and enable it for the project. The plugin needs Node.js on `PATH`; `.lsp.json` maps `.nflow` files to the bundled server, and `/flowfmt` formats a specified file. The server's hover text is intentionally a placeholder, and its completion list is a small syntax-oriented starter set.

## Formatting

`flowfmt` in `fmt/cli.js` is the canonical Go-fmt-style formatter: one deterministic output, with fixed two-space indentation, shared by the CLI and bundled editor integrations. It can run on save through VS Code and Zed's language-server integrations, be configured as a JetBrains File Watcher, or run from Notepad++'s NppExec command. VS Code's `editor.formatOnSave` setting is shown above; Zed's per-language settings are shown above.

To put the standalone formatter on your `PATH`, run `npm link` from this package directory; `flowfmt` then works as a local tool, much like `gofmt`. You can also call it through `node fmt/cli.js` without installing it globally.

```bash
flowfmt --check examples/complete.nflow test/fixtures/current-syntax.nflow
flowfmt -w examples/complete.nflow
node fmt/cli.js examples/complete.nflow       # preview to stdout
node fmt/cli.js --write examples/complete.nflow  # rewrite in place (`-w`)
node fmt/cli.js --check examples/complete.nflow test/fixtures/current-syntax.nflow
cat examples/complete.nflow | node fmt/cli.js --stdin
```

The formatter normalizes operators, inline v0.42 `@assert` expressions, and block indentation; it preserves line endings, UTF-8 BOMs, quoted content, Flow's whitespace-significant ternary separator, and expression predicates. It deliberately has no indentation or line-width overrides, so editors produce the same result. It remains conservative rather than compiler/AST-driven: it does not reorder modifiers, wrap long lines, or validate semantics. The example and syntax fixture cover single-expression, block, and compact-list assertions, plus the runtime `assert(...)` form, argument blocks, schema, control forms, selectors, arrays, and quoted strings. The Tree-sitter grammar is permissive and highlights unknown action names structurally, so new kernel actions do not need a hard-coded list.

## Validate and package

Run the complete local checks:

```bash
npm run validate
cargo check --manifest-path zed/Cargo.toml
cargo check --manifest-path zed-legacy-0.230.2/Cargo.toml
```

`npm run validate` runs formatter/LSP tests, a mocked VS Code extension-host test, an idempotence check, Tree-sitter generation and parsing, and cross-editor metadata/copy checks. The Cargo commands compile-check both Zed wrappers. The release script repeats validation in an isolated temporary staging area and leaves unrelated files in the selected output directory untouched:

```bash
bash scripts/package-release.sh dist
```

The output includes separate VS Code, current/legacy Zed, Notepad++, Claude Code, and JetBrains packages, plus a complete source archive and `SHA256SUMS`. Native Notepad++, JetBrains, and Claude Code application UIs are not part of the automated test environment; their manifests/assets are structurally validated here.

## License

Apache-2.0. This editor-support repository is a companion to the Nexss Flow project; confirm upstream licensing and contribution terms before publishing a combined distribution.
