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
Use the latest stable release for current language syntax; this editor-support revision is tested against Nexss Flow v0.67.0. Its pinned test core is built from the v0.67.0 source tag because that tag does not yet have published binary assets. The shared LSP launcher keeps a v0.44.2 compatibility floor, but older cores may not expose newer language-server features.
The shell-based language-server launchers use `NEXSS_NFLOW_NODE` to select a Node.js executable when `node` is not on `PATH`.

```sh
nflow --version
nflow fmt --write path/to/file.nflow
nflow lint
```

## Validate

If `nflow` is not on `PATH`, set the single executable override `NFLOW_BIN`, then run. Validation installs the pinned v0.67.0 core from source and requires Go 1.27.3 or newer:

```sh
npm ci
npm run validate
```

## License

Apache-2.0.
