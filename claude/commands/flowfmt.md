---
name: flowfmt
description: Format Nexss Flow files with the canonical nflow formatter
argument-hint: "[file or directory]"
---
Format the requested Flow file or files using the bundled adapter at `${CLAUDE_PLUGIN_ROOT}/fmt/cli.js`. It is only a wrapper for Flow core's `nflow fmt`; do not implement or imitate formatting rules in the shell or through another formatter.
- If `$ARGUMENTS` is a file, run `node "${CLAUDE_PLUGIN_ROOT}/fmt/cli.js" --write "$ARGUMENTS"`.
- If `$ARGUMENTS` is empty, inspect the current project for `.nflow` files and ask before changing multiple files.
- After writing, run `node "${CLAUDE_PLUGIN_ROOT}/fmt/cli.js" --check` on the changed paths and report the paths changed.
- The adapter uses `NFLOW_BIN` when set, otherwise `nflow` on `PATH`. Install Flow v0.43.0 or newer; if the core formatter is unavailable or rejects v0.43 syntax, report the dependency/version failure and do not fall back to another formatter.
