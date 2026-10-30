# Nexss Flow editor support
<small>Nexss Flow 🌀 ready</small>

Editor integrations for `.nflow` files. Language services and formatting come from Nexss Flow core through `nflow`.

## Editors

| Editor | Support |
| --- | --- |
| VS Code | LSP diagnostics, code intelligence, formatting and syntax highlighting. |
| Zed | Install as a dev extension; LSP features, formatting and syntax highlighting. |
| Claude Code | LSP code intelligence; `/flowfmt` runs `nflow fmt`. |
| Notepad++ | Syntax highlighting; optional NppExec formatting command. |
| JetBrains IDEs | Syntax highlighting; configure an External Tool to run `nflow fmt`. |

Available LSP features depend on the installed Nexss Flow version.

## Install

Install `nflow` from the [Nexss Flow releases](https://github.com/nexssp/flow/releases). Set `NFLOW_BIN` if your editor cannot find it; VS Code also supports `nexssFlow.nflowCommand`.

```sh
nflow --version
nflow fmt --write path/to/file.nflow
nflow lint
```

## Validate

Point `NFLOW_BIN`, `FLOW_NFLOW_BIN`, and `FLOW_NFLOW_LSP_BIN` at the same `nflow` executable, then run:

```sh
npm ci
npm run validate
```

## License

Apache-2.0.
