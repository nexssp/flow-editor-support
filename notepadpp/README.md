# Nexss Flow for Notepad++

Import `flow-udl.xml` through **Language → Define your language → Import**. If required, associate `.nflow` files with **Nexss Flow**. The profile colors Flow syntax but does not validate it.

## Formatting with NppExec

1. Install a Flow build that provides `nflow fmt` and the **NppExec** plugin.
2. Ensure `nflow` is on `PATH`, or set `NFLOW_BIN` in the environment Notepad++ inherits.
3. Copy `flowfmt.cmd` to `<Notepad++>\plugins\Config\flowfmt.cmd`.
4. Open `nppexec/Format-Flow.npes` in NppExec and run it, or paste its contents into **Plugins → NppExec → Execute...**. Bind the command to a shortcut if desired.

The helper saves the current document, runs `nflow fmt --write` on it, and reopens it. It does not contain formatting rules. `//` is the portable line comment used by the profile; `#` is intentionally not treated as a comment because Flow also uses it for selectors and expression predicates.
