# Nexss Flow for Notepad++

Import `flow-udl.xml` through **Language → Define your language → Import**. If required, associate `.nflow` files with **Nexss Flow**. The profile colors Flow syntax but does not validate it or provide LSP diagnostics.

## Formatting with NppExec

1. Install the latest stable Flow release (this editor-support revision is tested against v0.64.0) and the **NppExec** plugin; v0.44.2 is the shared tooling compatibility floor. Confirm the installed version with `nflow --version`.
2. Ensure `nflow` is on `PATH`, or set `NFLOW_BIN` in the environment Notepad++ inherits.
3. Copy `flowfmt.cmd` to `<Notepad++>\\plugins\\Config\\flowfmt.cmd`.
4. Open `nppexec/Format-Flow.npes` in NppExec and run it, or paste its contents into **Plugins → NppExec → Execute...**. Bind the command to a shortcut if desired.

The helper saves the current document, runs core `nflow fmt --write`, and reopens it. It has no independent formatting rules, and invalid source is left unchanged if formatting fails. Run `nflow lint` in a terminal for compiler/project diagnostics that the User Defined Language profile cannot provide. `//` is the portable line comment used by the profile; `#` is not treated as a comment because Flow also uses it for selectors and expression predicates.
