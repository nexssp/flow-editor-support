# Nexss Flow for Claude Code

This plugin starts Flow core's native LSP for `.nflow` files. Its diagnostics and code intelligence come from `nflow lsp`; the bundled `lsp/nflow-lsp.js` only checks the selected core version and forwards stdio to the executable. Install Flow v0.44.1 or newer and make it available on Claude Code's `PATH`, or set `NFLOW_BIN` in the environment Claude Code inherits.

Keep `/flowfmt` as the explicit formatting command. It forwards to the core `nflow fmt` command and honors `NFLOW_BIN`; it contains no formatting rules and does not provide automatic format-on-save. Claude Code does not color source files, so syntax highlighting remains the responsibility of the host editor. The native core currently provides a fixed syntax-oriented completion list and generic hover text; see the [Flow v0.44.1 LSP implementation](https://github.com/nexssp/flow/blob/a17c87fd106002128120e6cd359589b4768eef55/cli/lsp.go#L335-L369).
