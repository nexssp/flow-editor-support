# Nexss Flow editor support

Editor tooling for Nexss Flow, whose canonical source format is **`.nflow`**. The core reference implementation is the [Flow v0.44.1 release](https://github.com/nexssp/flow/releases/tag/v0.44.1); the [official editor-support v0.3.1 source](https://github.com/nexssp/flow-editor-support/tree/v0.3.1) is the baseline being updated here.

## One core for language services

Flow core now owns language parsing, diagnostics, completion, hover, and document formatting. Editors that support LSP start **`nflow lsp`** through the shared `lsp/nflow-lsp.js` launcher. The launcher only selects and checks the executable, then passes stdio directly through to Flow; it does not parse source, generate diagnostics, or format text. Formatting continues to use **`nflow fmt`**, and project-wide compilation checks use **`nflow lint`**.

The launcher requires **Flow v0.44.1 or newer** and checks the selected executable's `--version` before starting the server. This minimum is grounded in the tagged core: [the v0.44.1 server advertises sync, diagnostics-backed language analysis, completion, hover and formatting](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/cli/lsp.go#L335-L369). It reports an incompatible or missing core to stderr and does not start an older server.

The core LSP publishes diagnostics when a document opens or changes and clears them when the source is corrected. Formatting errors are returned as LSP errors with diagnostics, not as an empty successful edit. See the [v0.44.1 diagnostic and formatting handlers](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/cli/lsp.go#L372-L453) and [formatting error path](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/cli/lsp.go#L515-L542).

LSP diagnostics are not a substitute for every `nflow lint` project check. In particular, the released LSP documents that external `@require` bundles not linked into the running binary need `nflow lint`; the core reports this limitation rather than silently dropping the requirement. The LSP currently uses full-document changes, generic placeholder hover text, and a fixed set of syntax-oriented completion snippets. See the [native LSP implementation](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/cli/lsp.go#L289-L369) and [`nflow lint` guidance](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/docs/cli.md#L93-L110).

## Editor support at a glance

| Editor | Language support and formatting | Where a manual task or fallback remains |
| --- | --- | --- |
| **VS Code** | Core LSP diagnostics, completion, hover and **Format Document**; optional format-on-save. | No separate fallback is needed for normal LSP features. A custom `nexssFlow.languageServer.command` overrides the bundled launcher and its version check. |
| **Zed (current and legacy 0.230.2)** | Core LSP diagnostics, completion, hover and formatting; optional format-on-save. Tree-sitter continues to handle highlighting. | Install a compatible Flow binary where Zed can find it, or set `NFLOW_BIN`. The language grammar is fetched at the revision declared by the extension manifest. |
| **Claude Code** | Core LSP diagnostics and code intelligence through `.lsp.json`. | Keep `/flowfmt` as the explicit formatting command; Claude Code's plugin LSP integration is used for diagnostics and code intelligence, not automatic format-on-save. The host editor handles source coloring. |
| **Notepad++** | User Defined Language colorization and an NppExec formatting command. | No LSP diagnostics; run `nflow lint` in a terminal when full project checks are needed and use the NppExec command for explicit formatting. |
| **JetBrains IDEs** | TextMate syntax highlighting; an External Tool or File Watcher invokes the core formatter. | This package has no native JetBrains LSP/inspection provider. Run `nflow lint` manually for diagnostics; formatting can be one-off or configured as a File Watcher. |

The LSP capabilities come from Flow core rather than editor-specific parsers. Official editor references: [VS Code Language Server clients](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide), [Zed language settings and formatting](https://zed.dev/docs/configuring-languages), and [Claude Code plugin LSP servers](https://code.claude.com/docs/en/plugins/components#lsp-servers).

## Install and choose the Flow executable

Install the released Flow binary for your platform from the [v0.44.1 release](https://github.com/nexssp/flow/releases/tag/v0.44.1), or build the core from its source. Check the version in the environment inherited by your editor:

```sh
nflow --version
```

The language-server launcher selects the executable in this order: `NFLOW_BIN`, `FLOW_NFLOW_LSP_BIN`, `FLOW_NFLOW_BIN`, then `nflow` on `PATH`. `NFLOW_BIN` is the normal user override; the `FLOW_NFLOW_*` variables are also used by the repository's real-core tests. The launcher supports executable paths containing spaces and runs `nflow lsp` without a shell.

In VS Code, `nexssFlow.nflowCommand` sets the Flow executable path for the language-server process and takes precedence over `NFLOW_BIN`. For Zed and Claude Code, set `NFLOW_BIN` in the environment those apps inherit. If the selected binary is missing, too old, or does not report a parseable version, the launcher prints an error to stderr instead of silently degrading. A manually configured VS Code `nexssFlow.languageServer.command` is an advanced override and bypasses this check.

The installer used by CI fetches the official v0.44.1 Linux amd64 archive and verifies its published checksum. Its `--check` mode accepts v0.44.1 or later; to emit the three test variables for one binary:

```sh
eval "$(bash scripts/install-flow-core.sh --check /path/to/nflow)"
```

## VS Code

Install the published VSIX, or package the `vscode/` extension with its pinned `vscode-languageclient` dependency. `.nflow` files activate the language client, which connects the editor to Flow's native LSP. The core server's diagnostics, completion, hover, and formatting responses are surfaced by the standard VS Code language client.

To format automatically when saving, add this to VS Code settings; **Format Document** is available at any time:

```json
"[nexss-flow]": {
  "editor.defaultFormatter": "nexssp.nexss-flow-syntax",
  "editor.formatOnSave": true
}
```

Set `nexssFlow.nflowCommand` to the executable path if it is not on `PATH` and `NFLOW_BIN` is not set. Leave `nexssFlow.languageServer.command` blank to use the native-core launcher.

## Zed

Use `nexss-flow-zed.zip` for current Zed or `nexss-flow-zed-legacy-0.230.2.zip` for the supported legacy package. Extract the archive and select the directory containing `extension.toml` in **Install Dev Extension**. Both wrappers start the same version-checking launcher and preserve the Zed shell environment.

To enable formatting on save, configure:

```json
"languages": {
  "Nexss Flow": {
    "formatter": "language_server",
    "format_on_save": "on",
    "tab_size": 2
  }
}
```

The Tree-sitter grammar is fetched from the repository revision in the extension manifest. A local grammar change is not visible to an installed extension until that revision is available; do not commit a machine-specific `file://` URL.

## Claude Code

Install the `claude/` plugin package and enable it for the project. The plugin starts Node.js with `lsp/nflow-lsp.js`, which checks the selected Flow binary and then starts `nflow lsp`. Claude Code uses the native server for diagnostics and code intelligence. The plugin retains `/flowfmt` as a manual command, forwarding to core `nflow fmt`; it does not reimplement formatting or promise format-on-save.

## Notepad++

Import `notepadpp/flow-udl.xml` through **Language → Define your language → Import** and associate `.nflow` if needed. The User Defined Language profile provides colorization only; it does not validate the source. `//` is the portable line comment; `#` is not colored as a comment because Flow also uses it for selectors and expression predicates.

For explicit formatting, install NppExec, ensure `nflow` is on `PATH` or set `NFLOW_BIN`, copy `flowfmt.cmd` to `<Notepad++>\\plugins\\Config\\flowfmt.cmd`, and run `nppexec/Format-Flow.npes`. The command saves, formats and reopens the current document. Invalid source is not rewritten by core `nflow fmt --write`. Run `nflow lint` in a terminal for project diagnostics that the UDL cannot provide.

## JetBrains IDEs

Add `jetbrains/textmate` under **Settings/Preferences → Editor → TextMate Bundles** and associate `*.nflow` if the IDE does not do so automatically. The TextMate bundle only colors text; this package does not include the native JetBrains LSP/inspection integration or PSI-aware refactorings.

For manual formatting, set an External Tool's **Program** to `nflow` or its full path and **Arguments** to:

```text
fmt --write "$FilePath$"
```

A File Watcher can run the same command on save. The selected **Program** controls which executable is used; `NFLOW_BIN` does not replace that field. For full project compilation checks, run `nflow lint` as a manual task or External Tool. Invalid files remain unchanged if formatting fails.

## Formatting and linting

`nflow fmt` is the only formatting implementation. It supports `nflow fmt FILE` (formatted output to stdout), `nflow fmt --write FILE` (atomic rewrite), `nflow fmt --check FILE`, and `nflow fmt --stdin`. Invalid source is rejected before a file is replaced; this behavior is covered by the [v0.44.1 formatter implementation and tests](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/cli/fmt.go#L113-L147). `nflow lint` performs the compiler/project checks described in the [Flow CLI guide](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/docs/cli.md#L101-L110).

The shared `fmt/` files are argument-forwarding adapters only. They do not define spacing, indentation, line-wrapping, parsing, or diagnostics. Tree-sitter and TextMate grammars remain syntax-highlighting tools, not alternate compilers.

## Validation

Set all real-core variables to the same verified v0.44.1 executable so integration tests cannot silently skip:

```sh
export NFLOW_BIN=/path/to/nflow
export FLOW_NFLOW_BIN=/path/to/nflow
export FLOW_NFLOW_LSP_BIN=/path/to/nflow
npm ci
npm run validate
cargo check --manifest-path zed/Cargo.toml
cargo check --manifest-path zed-legacy-0.230.2/Cargo.toml
```

`npm run validate` exercises adapter launch and version checks, real-core formatting, native LSP diagnostics and formatting over stdio, syntax fixtures, metadata consistency, and invalid-source preservation. GUI smoke tests require installed editor applications; automated protocol checks do not claim to have tested editor UI behavior.

## Go templates in `template.render`

The Zed Tree-sitter grammar and VS Code/JetBrains TextMate grammar recognize Go `text/template` actions only in the top-level `template:` string of a `template.render @{...}` expression. Template action delimiters, control words, field variables, and the current-context dot receive separate scopes. Neighboring strings, ordinary object values, and nested `template:` fields remain ordinary Flow strings. Notepad++ leaves template values as ordinary strings because its UDL cannot provide context-aware nested highlighting without coloring unrelated text. Claude Code relies on its host editor for source highlighting.

## License

Apache-2.0. This editor-support repository is a companion to Nexss Flow; confirm upstream licensing and contribution terms before publishing a combined distribution.
