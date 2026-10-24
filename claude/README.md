# Nexss Flow for Claude Code

This plugin package provides completion and placeholder hover through `.lsp.json`, plus the `/flowfmt` command. It requires Node.js on `PATH`; `.nflow` files map to the bundled stdio LSP server.

The server is deliberately small: completions are syntax-oriented examples and hover text is a placeholder. It does not publish compiler diagnostics or semantic navigation. Claude Code does not color source files, so syntax highlighting remains the responsibility of the host editor.
