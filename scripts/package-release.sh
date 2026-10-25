#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)"
OUT="${1:-$ROOT/dist}"
if [[ "$OUT" = /* ]]; then OUT_DIR="$OUT"; else OUT_DIR="$ROOT/$OUT"; fi
OUT_DIR="$(python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).resolve())' "$OUT_DIR")"
if [[ "$OUT_DIR" = "/" || "$OUT_DIR" = "$ROOT" ]]; then
  echo "Refusing to use an unsafe release output directory: $OUT_DIR" >&2
  exit 2
fi

# Validate the exact formatter core before staging or running tests. This keeps
# missing/incompatible cores from silently skipping the real-core test suite.
CORE_ENV="$(bash "$ROOT/scripts/install-flow-core.sh" --check)"
eval "$CORE_ENV"
echo "Verified Flow core v0.44.1 or newer: $FLOW_NFLOW_BIN" >&2

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/nexss-flow-release.XXXXXX")"
trap 'rm -rf -- "$STAGE"' EXIT
SRC="$STAGE/source"
mkdir -p "$SRC"

# Work only in the temporary staging copy. The user's repository and existing
# output directory contents are never removed or modified by this script.
for item in README.md LICENSE assets grammar.js src examples fmt lsp zed zed-legacy-0.230.2 vscode notepadpp claude jetbrains package.json package-lock.json scripts test .zed .github; do
  cp -a "$ROOT/$item" "$SRC/"
done
rm -rf -- "$SRC/zed/target" "$SRC/zed-legacy-0.230.2/target"

mkdir -p "$SRC/vscode/lsp" "$SRC/vscode/fmt" \
  "$SRC/zed/lsp" "$SRC/zed/fmt" \
  "$SRC/zed-legacy-0.230.2/lsp" "$SRC/zed-legacy-0.230.2/fmt" \
  "$SRC/zed-legacy-0.230.2/grammars" "$SRC/claude/lsp" "$SRC/claude/fmt" \
  "$SRC/notepadpp/fmt" "$SRC/jetbrains/fmt"
cp "$SRC/LICENSE" "$SRC/vscode/LICENSE"
cp "$SRC/lsp/nflow-lsp.js" "$SRC/vscode/lsp/nflow-lsp.js"
cp "$SRC/lsp/nflow-lsp.js" "$SRC/zed/lsp/nflow-lsp.js"
cp "$SRC/lsp/nflow-lsp.js" "$SRC/zed-legacy-0.230.2/lsp/nflow-lsp.js"
cp "$SRC/lsp/nflow-lsp.js" "$SRC/claude/lsp/nflow-lsp.js"
cp "$SRC/fmt/index.js" "$SRC/vscode/fmt/index.js"
cp "$SRC/fmt/index.js" "$SRC/zed/fmt/index.js"
cp "$SRC/fmt/index.js" "$SRC/zed-legacy-0.230.2/fmt/index.js"
cp "$SRC/fmt/index.js" "$SRC/claude/fmt/index.js"
cp "$SRC/fmt/cli.js" "$SRC/claude/fmt/cli.js"
cp "$SRC/fmt/index.js" "$SRC/notepadpp/fmt/index.js"
cp "$SRC/fmt/cli.js" "$SRC/notepadpp/fmt/cli.js"
cp "$SRC/fmt/index.js" "$SRC/jetbrains/fmt/index.js"
cp "$SRC/fmt/cli.js" "$SRC/jetbrains/fmt/cli.js"
cp "$SRC/grammar.js" "$SRC/zed/grammars/flow.js"
cp "$SRC/grammar.js" "$SRC/zed-legacy-0.230.2/grammar.js"
cp "$SRC/grammar.js" "$SRC/zed-legacy-0.230.2/grammars/flow.js"
cp "$SRC/vscode/syntaxes/flow.tmLanguage.json" "$SRC/jetbrains/textmate/nexss-flow.tmLanguage.json"
chmod +x "$SRC/zed/lsp/nexss-flow-language-server" "$SRC/zed-legacy-0.230.2/lsp/nexss-flow-language-server" \
  "$SRC/fmt/cli.js" "$SRC/claude/fmt/cli.js" "$SRC/notepadpp/fmt/cli.js" "$SRC/jetbrains/fmt/cli.js" \
  "$SRC/scripts/package-release.sh" "$SRC/scripts/check-grammar.sh" "$SRC/scripts/install-flow-core.sh"

(cd "$SRC" && python3 scripts/validate.py)
(cd "$SRC" && node --test fmt/test/*.test.js vscode/test/*.test.js test/nflow-lsp.test.js)
(cd "$SRC" && node fmt/cli.js --check examples/complete.nflow test/fixtures/current-syntax.nflow)
(cd "$SRC" && bash scripts/check-grammar.sh)

(cd "$SRC" && zip -qr "$STAGE/nexss-flow-source.zip" README.md LICENSE assets grammar.js src examples fmt lsp zed zed-legacy-0.230.2 vscode notepadpp claude jetbrains package.json package-lock.json scripts test .zed .github)
(cd "$SRC/zed" && zip -qr "$STAGE/nexss-flow-zed.zip" .)
(cd "$SRC/zed-legacy-0.230.2" && zip -qr "$STAGE/nexss-flow-zed-legacy-0.230.2.zip" .)
(cd "$SRC/notepadpp" && zip -qr "$STAGE/nexss-flow-notepadpp.zip" .)
(cd "$SRC/claude" && zip -qr "$STAGE/nexss-flow-claude-code.zip" .)
(cd "$SRC/jetbrains" && zip -qr "$STAGE/nexss-flow-jetbrains.zip" .)
if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to build the VS Code VSIX" >&2
  exit 1
fi
(cd "$SRC/vscode" && npm ci --omit=dev --no-audit --no-fund)
(cd "$SRC/vscode" && npx --yes @vscode/vsce package --out "$STAGE/nexss-flow-vscode.vsix")

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$STAGE" && sha256sum nexss-flow*.zip nexss-flow*.vsix > SHA256SUMS)
else
  (cd "$STAGE" && shasum -a 256 nexss-flow*.zip nexss-flow*.vsix > SHA256SUMS)
fi
mkdir -p "$OUT_DIR"
for artifact in "$STAGE"/nexss-flow*.zip "$STAGE"/nexss-flow*.vsix "$STAGE"/SHA256SUMS; do
  mv -f -- "$artifact" "$OUT_DIR/"
done
printf 'Packaged editor artifacts in %s\n' "$OUT_DIR"
