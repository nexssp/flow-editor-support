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
The shell-based language-server launchers use `NEXSS_NFLOW_NODE` to select a Node.js executable when `node` is not on `PATH`.

```sh
nflow --version
nflow fmt --write path/to/file.nflow
nflow lint
```

## Validate

If `nflow` is not on `PATH`, set the single executable override `NFLOW_BIN`, then run:

```sh
npm ci
npm run validate
```

## License

Apache-2.0.
