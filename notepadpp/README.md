# Nexss Flow for Notepad++

Import `flow-udl.xml` through **Language → Define your language → Import**. If required, associate `.nflow` files with **Nexss Flow**. The profile colors Flow syntax but does not validate it.

## Formatting with NppExec

1. Install Node.js and the **NppExec** plugin.
2. Copy `flowfmt.cmd` to `<Notepad++>\plugins\Config\flowfmt.cmd`.
3. Copy the `fmt/` directory included in the standalone Notepad++ ZIP to `<Notepad++>\plugins\fmt\`.
4. Open `nppexec/Format-Flow.npes` in NppExec and run it, or paste its contents into **Plugins → NppExec → Execute...**. Bind the command to a shortcut if desired.

The helper resolves `fmt/cli.js` relative to the sibling `plugins` directory, saves the current document, formats it, and reopens it. It preserves UTF-8 BOMs and the dominant CRLF/LF line ending. `//` is the portable line comment used by the profile; `#` is intentionally not treated as a comment because Flow also uses it for selectors and expression predicates.
