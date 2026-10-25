# Nexss Flow for JetBrains IDEs

## Syntax highlighting

In **Settings/Preferences → Editor → TextMate Bundles → Add**, select the `jetbrains/textmate` directory. The grammar declares the `nflow` file type; associate `*.nflow` manually if the IDE does not do so automatically.

## Formatting

Use Flow v0.43.0 or newer and confirm the executable version with `nflow --version`. Configure an External Tool for manual formatting or a File Watcher for formatting on save. Set **Program** to `nflow` when it is on `PATH`, or to the full path of the Flow executable. Set **Arguments** to:

```text
fmt --write "$FilePath$"
```

For a File Watcher, restrict the watcher to Flow/`.nflow` files. A direct External Tool or File Watcher launches the executable selected in **Program**; setting `NFLOW_BIN` does not replace that path. The tool delegates all formatting to the real `nflow fmt` command and has no bundled formatting algorithm. The TextMate bundle provides coloring only; native **Reformat Code**, code-style panels, inspections, and PSI-aware refactorings require a dedicated IntelliJ Platform plugin and are not included here.
