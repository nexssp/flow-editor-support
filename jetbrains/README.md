# Nexss Flow for JetBrains IDEs

## Syntax highlighting

In **Settings/Preferences → Editor → TextMate Bundles → Add**, select the `jetbrains/textmate` directory. The grammar declares the `nflow` file type; associate `*.nflow` manually if the IDE does not do so automatically.

## Formatting

The standalone JetBrains ZIP includes `fmt/cli.js` and `fmt/index.js`; the complete source archive includes the same formatter at its root. Run it as an External Tool or File Watcher:

```text
node "<standalone-package-or-source-root>/fmt/cli.js" --write "$FilePath$"
```

This invokes the shared canonical two-space formatter. The TextMate bundle provides coloring only; native **Reformat Code**, code-style panels, inspections, and PSI-aware refactorings require a dedicated IntelliJ Platform plugin and are not included here.
