# Nexss Flow for JetBrains IDEs

## Syntax highlighting

JetBrains IDEs can import TextMate bundles. Use **Settings/Preferences → Editor → TextMate Bundles → Add** and select the `jetbrains/textmate` directory. Associate `*.flow` with the imported Nexss Flow grammar if the IDE does not do so automatically.

## Formatting

The current portable integration is an External Tool or File Watcher invoking:

```text
node <repository>/fmt/cli.js --write $FilePath$
```

For native **Reformat Code**, code-style panels, inspections, and PSI-aware refactorings, Flow needs a dedicated IntelliJ Platform plugin with a lexer/parser and `FormattingModelBuilder`. The TextMate bundle provides coloring only and does not provide native JetBrains formatting.
