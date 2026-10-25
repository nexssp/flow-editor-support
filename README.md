# Nexss Flow editor support

Editor tooling for Nexss Flow, the workflow language maintained in the [Nexss Flow repository](https://github.com/nexssp/flow). The canonical source format is **`.nflow`**; current language syntax is documented in the [Flow language reference](https://github.com/nexssp/flow/blob/main/docs/language-reference.md).

This package provides syntax highlighting, snippets, a small stdio Language Server Protocol (LSP) server, and thin formatter adapters. It does **not** implement formatting rules: every editor forwards formatting to the Flow executable's `nflow fmt` command. Use [Flow v0.43.0](https://github.com/nexssp/flow/releases/tag/v0.43.0) or newer, or a compatible Flow core build that includes `nflow fmt`; editor integrations report a missing core dependency rather than silently falling back to a different formatter. Flow v0.43.0 is the first released core version with the built-in formatter. The editor support targets v0.43.0 language syntax, including single-expression, block, and compact-list `@assert` forms.

Check `nflow --version` in the environment the editor inherits: it must report v0.43.0 or newer. An older Flow build can expose an `nflow fmt` command yet still reject v0.43 syntax, so a working `fmt` subcommand alone is not enough.

## What each editor gets

| Editor | Included support and formatting path | What it does not provide |
| --- | --- | --- |
| **VS Code** | `.nflow` association, TextMate highlighting, snippets, completion, placeholder hover, and **Format Document** via `nflow fmt`; optional format-on-save. | No continuous compiler diagnostics or semantic navigation; formatter parse errors are published at their source position when formatting is requested. |
| **Zed** | Tree-sitter highlighting, bracket matching, and LSP formatting via **Format Document**; optional format-on-save. Current and legacy packages are included. | The grammar is fetched from the Git revision declared in the extension manifest; see the Zed note below. |
| **Notepad++** | User Defined Language profile and an NppExec command that runs `nflow fmt` on demand (can be bound to a shortcut). | UDL is colorization only; this package does not register a native format-on-save provider. |
| **JetBrains IDEs** | TextMate syntax highlighting and an External Tool or File Watcher that runs `nflow fmt`; a File Watcher can run on save. | No native IntelliJ **Reformat Code**, code-style panels, inspections, or PSI-aware refactorings. |
| **Claude Code** | LSP completion/placeholder hover and the `/flowfmt` command for explicit formatting through `nflow fmt`. | No source-file colorization or automatic format-on-save command; the host editor handles highlighting. |

## Go templates in `template.render`

The Zed Tree-sitter grammar and the VS Code/JetBrains TextMate grammar recognize Go `text/template` actions only in the top-level `template:` string of a `template.render @{...}` expression. Action delimiters (including whitespace-trim markers), control words such as `range` and `end`, field variables such as `.customer` and `.items`, and the current-context dot (`.`) receive separate scopes. Neighboring strings, ordinary object values, and nested `template:` fields remain ordinary Flow strings; template content is not injected into every quoted value.

Notepad++ uses its User Defined Language profile, which cannot embed a context-aware nested grammar without also coloring matching text in unrelated strings, so it leaves these values as ordinary strings. Claude Code does not color source files itself and relies on its host editor. The `nflow fmt` integration preserves the supplied template string and remains idempotent.

## Install and configure

### VS Code

Install `nexss-flow-vscode.vsix` from the release artifacts, or open the `vscode/` folder as the extension project and package it with `@vscode/vsce`. The bundled language server starts with the VS Code extension's Node runtime. `.nflow` files activate the extension automatically.

To enable format-on-save, add this to VS Code settings. You can also run **Format Document** from the command palette at any time:

```json
"[nexss-flow]": {
  "editor.defaultFormatter": "nexssp.nexss-flow-syntax",
  "editor.formatOnSave": true
}
```

The extension uses `nflow` on `PATH` by default. Set `nexssFlow.nflowCommand` to the executable's path if it is installed elsewhere; alternatively, set `NFLOW_BIN` in the extension's environment. This value is an executable path, not a command plus arguments. A custom compatible stdio LSP can still be set with `nexssFlow.languageServer.command` and its separate `nexssFlow.languageServer.args` array; it must implement `textDocument/formatting` for formatting to work.

### Zed

Use `nexss-flow-zed.zip` for current Zed versions, or `nexss-flow-zed-legacy-0.230.2.zip` for older Zed 0.230.2. Extract the archive and select the folder containing `extension.toml` in **Install Dev Extension**.

The extension wrapper resolves the bundled `lsp/flow-language-server.js` from the extension directory and uses Zed's Node runtime. Formatting is delegated to `nflow fmt`; install Flow v0.43.0 or newer on the environment inherited by Zed, or set `NFLOW_BIN` to that executable's path. To format on save, set the language formatter to `language_server` and `format_on_save` to `on`. The Tree-sitter grammar is a separate repository source: both manifests fetch `https://github.com/nexssp/flow-editor-support` at the configured `main` revision. Consequently, Zed will not see a grammar change made only in a local, unpublished copy; first publish the updated support-repository revision, or use a **local-only** `file://` repository URL while developing. Do not commit a machine-specific `file://` URL. See [Zed's language-extension documentation](https://zed.dev/docs/extensions/languages) and [language settings](https://zed.dev/docs/configuring-languages) for details.

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

For formatting, install Flow v0.43.0 or newer and the NppExec plugin. Ensure `nflow` is on `PATH`, or set `NFLOW_BIN` to the full executable path in the environment Notepad++ inherits. Copy `notepadpp/flowfmt.cmd` to `<Notepad++>\plugins\Config\flowfmt.cmd`, then run `notepadpp/nppexec/Format-Flow.npes` from **Plugins → NppExec → Execute...**. The command saves, formats, and reopens the current document; it may be bound to a shortcut.

### JetBrains IDEs

In **Settings/Preferences → Editor → TextMate Bundles**, add `jetbrains/textmate`. The grammar declares the `nflow` file type; associate `*.nflow` manually if the IDE does not do so automatically.

For one-off formatting, configure an External Tool with **Program** set to `nflow` (or the full path to the Flow v0.43.0-or-newer executable) and **Arguments** set to:

```text
fmt --write "$FilePath$"
```

For formatting on save, configure the same command as a File Watcher for Flow/`.nflow` files. A direct External Tool launches the executable selected in **Program**; setting `NFLOW_BIN` does not replace that executable path. The TextMate bundle provides coloring only, not native JetBrains formatting support.

### Claude Code

Install the `claude/` folder as a Claude Code plugin and enable it for the project. The plugin needs Node.js on `PATH` for its LSP. `/flowfmt path/to/file.nflow` uses the bundled adapter, which forwards to Flow core's `nflow fmt` and honors `NFLOW_BIN` (otherwise it uses `nflow` on `PATH`). Install Flow v0.43.0 or newer and verify the version in the environment Claude Code inherits. The server's hover text is intentionally a placeholder, and its completion list is a small syntax-oriented starter set.

## Formatting

**`nflow fmt` is the single source of truth.** `fmt/index.js` is only an adapter that sends the document to `nflow fmt --stdin` and returns its output verbatim; `fmt/cli.js` forwards command-line arguments to `nflow fmt`. The LSPs and each editor package use these adapters or invoke the same executable directly. No editor bundle has its own formatter algorithm, spacing rule, indentation rule, or line-wrapping policy.

The core formatter handles modifier attributes written compactly or with spaces (for example `action:timeout=1s:retry=2` and `action :timeout=1s :retry=2`), indented multiline modifier lists, and readable top-level pipeline continuations. It splits multi-attribute declaration headers into ordered, indented `:attribute` lines where Flow syntax allows; object fields (`key: value`) and whitespace-significant ternary separators (`yes : no`) keep their distinct meanings. Comments, strings, and raw expression text are not reserialized by editor code.

The released command supports `nflow fmt FILE` (formatted output to stdout), `nflow fmt --write FILE` (atomic rewrite), `nflow fmt --check FILE` (check without writing), and `nflow fmt --stdin` (read source from stdin and write formatted source to stdout). Multiple files require `--write` or `--check`; invalid source is not rewritten. The same command can be used in any editor or terminal:

```bash
nflow fmt --check examples/complete.nflow test/fixtures/current-syntax.nflow
nflow fmt --write examples/complete.nflow
printf 'source->action\n' | nflow fmt --stdin
```

The `flowfmt` executable is a compatibility wrapper for `nflow fmt`; it contains no independent rules. `npm run validate` runs adapter/LSP tests, a VS Code API-harness test, Tree-sitter generation and parsing, and cross-editor metadata/copy checks. Set `FLOW_NFLOW_BIN` and `NFLOW_BIN` to a real Flow v0.43.0-or-newer executable when running integration tests so they exercise the actual core rather than only mocks:

```bash
FLOW_NFLOW_BIN=/path/to/nflow NFLOW_BIN=/path/to/nflow npm test
npm run validate
cargo check --manifest-path zed/Cargo.toml
cargo check --manifest-path zed-legacy-0.230.2/Cargo.toml
bash scripts/package-release.sh dist
```

The output includes separate VS Code, current/legacy Zed, Notepad++, Claude Code, and JetBrains packages, plus a complete source archive and `SHA256SUMS`. Native editor UI testing requires those editor applications; when they are unavailable, automated checks exercise the VS Code API/provider path, actual LSP/CLI routes, and package wiring without claiming a live application test.

## License

Apache-2.0. This editor-support repository is a companion to the Nexss Flow project; confirm upstream licensing and contribution terms before publishing a combined distribution.
