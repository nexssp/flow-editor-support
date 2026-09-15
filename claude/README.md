# Nexss Flow for Claude Code

This directory is a Claude Code plugin package. It provides:

- Flow LSP code intelligence through `.lsp.json`.
- The `/flowfmt` command through `commands/flowfmt.md`.
- The shared `flowfmt` implementation.

Claude Code is not a syntax-coloring editor, so colors remain the responsibility of the host editor. Install the plugin with the Claude Code plugin workflow, then enable it for the project. The LSP command requires Node.js on `PATH`.
