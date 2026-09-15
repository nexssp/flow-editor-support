---
name: flowfmt
description: Format Nexss Flow files with the repository formatter
argument-hint: "[file or directory]"
---

Format the requested Flow file or files using the shared formatter.

- If `$ARGUMENTS` is a file, run `node "${CLAUDE_PLUGIN_ROOT}/fmt/cli.js" --write "$ARGUMENTS"`.
- If `$ARGUMENTS` is empty, inspect the current project for `.flow` files and ask before changing multiple files.
- Run the formatter's `--check` mode after writing and report changed paths.
- Do not change strings, modifier order, or semantic content.
