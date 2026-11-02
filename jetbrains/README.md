# Nexss Flow for JetBrains IDEs

## Syntax highlighting

In **Settings/Preferences → Editor → TextMate Bundles → Add**, select the `jetbrains/textmate` directory. The grammar declares the `nflow` file type; associate `*.nflow` manually if the IDE does not do so automatically.

## Formatting and checks

Install the latest stable Flow release (this editor-support revision is tested against v0.64.0); v0.44.2 is the shared tooling compatibility floor. Confirm the executable version with `nflow --version`. Configure an External Tool for manual formatting or a File Watcher for formatting on save. Set **Program** to `nflow` (if it is on `PATH`) or the full path of the Flow executable. Set **Arguments** to:

```text
fmt --write "$FilePath$"
```

A direct External Tool or File Watcher runs the executable selected in **Program**; setting `NFLOW_BIN` does not replace that path. Formatting delegates to core `nflow fmt`, which rejects invalid source before replacing the file. Run `nflow lint` as a manual task or External Tool when project-level diagnostics are needed.

This package provides TextMate coloring only. It does not configure a JetBrains Language Server Protocol client, native **Reformat Code**, code-style panels, inspections, or PSI-aware refactorings.
