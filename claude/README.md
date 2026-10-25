# Nexss Flow for Claude Code

This plugin package provides completion and placeholder hover through `.lsp.json`, plus the `/flowfmt` command. The bundled LSP needs Node.js on `PATH`; `.nflow` files map to the stdio server. Install Flow v0.43.0 or newer in the environment Claude Code inherits. The `/flowfmt` command runs the bundled `fmt/cli.js` adapter, which forwards formatting to the core `nflow fmt` command and uses `NFLOW_BIN` when set, otherwise `nflow` on `PATH`.

The server is deliberately small: completions are syntax-oriented examples and hover text is a placeholder. It does not publish compiler diagnostics or semantic navigation. Claude Code does not color source files, so syntax highlighting remains the responsibility of the host editor. `/flowfmt` is an explicit command, not automatic format-on-save; the adapter contains no formatting logic of its own.
