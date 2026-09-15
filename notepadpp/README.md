# Notepad++ formatting

The package includes the Nexss logo as `nexss-logo.png` for local documentation and distribution branding.

Formatting is provided on a best-effort basis through the NppExec plugin.

1. Install Node.js and the **NppExec** plugin.
2. Copy `flowfmt.cmd` and the repository `fmt/` directory to a stable location.
3. Open `nppexec/Format-Flow.npes` in NppExec and run it, or paste it into **Plugins > NppExec > Execute...**.
4. Bind the command to a shortcut if desired.

The command saves the current document, formats it with `flowfmt --write`, and reopens it. The formatter preserves UTF-8 BOMs and dominant CRLF line endings.
