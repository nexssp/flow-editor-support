# Nexss Flow for Notepad++

Import `flow-udl.xml` through **Language → Define your language → Import**. If required, associate `.nflow` files with **Nexss Flow**. The syntax colors use the active editor background and are tuned for light themes; common object fields are highlighted in teal. The profile does not validate source or provide LSP diagnostics.

Field highlighting uses a built-in list of common Flow fields, so custom field names remain in the default text color. To replace an already imported profile, remove the old **Nexss Flow** entry in **Language → User Defined Language → Define your language…**, then import this XML again. For dark themes, adjust the foreground colors in the UDL to suit the theme.

## Formatting with NppExec

1. Install the latest stable Flow release (this editor-support revision is tested against v0.67.0) and the **NppExec** plugin; v0.44.2 is the shared tooling compatibility floor. Confirm the installed version with `nflow --version`.
2. Ensure `nflow` is on `PATH`, or set `NFLOW_BIN` in the environment Notepad++ inherits.
3. Copy `flowfmt.cmd` to `<Notepad++>\\plugins\\Config\\flowfmt.cmd`.
4. Open `nppexec/Format-Flow.npes` in NppExec and run it, or paste its contents into **Plugins → NppExec → Execute...**. Bind the command to a shortcut if desired.

The helper saves the current document, runs core `nflow fmt --write`, and reopens it. It has no independent formatting rules, and invalid source is left unchanged if formatting fails. Run `nflow lint` in a terminal for compiler/project diagnostics that the User Defined Language profile cannot provide. `//` is the portable line comment used by the profile; `#` is not treated as a comment because Flow also uses it for selectors and expression predicates.
