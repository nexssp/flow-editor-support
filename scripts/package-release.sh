#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-dist}"
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if [[ "$OUT" = /* ]]; then
  OUT_DIR="$OUT"
else
  OUT_DIR="$ROOT/$OUT"
fi
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
chmod +x "$ROOT/lsp/nexss-flow-language-server" "$ROOT/zed/lsp/nexss-flow-language-server" "$ROOT/scripts/package-release.sh"
cp "$ROOT/LICENSE" "$ROOT/vscode/LICENSE"
mkdir -p "$ROOT/vscode/lsp"
cp "$ROOT/lsp/flow-language-server.js" "$ROOT/vscode/lsp/flow-language-server.js"
mkdir -p "$ROOT/zed/lsp"
cp "$ROOT/lsp/flow-language-server.js" "$ROOT/zed/lsp/flow-language-server.js"
mkdir -p "$ROOT/vscode/fmt" "$ROOT/zed/fmt"
cp "$ROOT/fmt/index.js" "$ROOT/vscode/fmt/index.js"
cp "$ROOT/fmt/index.js" "$ROOT/zed/fmt/index.js"

(cd "$ROOT" && zip -qr "$OUT_DIR/nexss-flow-source.zip" README.md LICENSE assets examples fmt lsp zed vscode notepadpp package.json scripts/validate.py .zed .github)
(cd "$ROOT/zed" && zip -qr "$OUT_DIR/nexss-flow-zed.zip" .)
(cd "$ROOT/notepadpp" && zip -qr "$OUT_DIR/nexss-flow-notepadpp.zip" .)

if command -v npx >/dev/null 2>&1; then
  (cd "$ROOT/vscode" && npx --yes @vscode/vsce package --out "$OUT_DIR/nexss-flow-vscode.vsix" --no-dependencies)
else
  echo "npx is required to build the VS Code VSIX" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_DIR"/* > "$OUT_DIR/SHA256SUMS"
else
  shasum -a 256 "$OUT_DIR"/* > "$OUT_DIR/SHA256SUMS"
fi
printf 'Packaged editor artifacts in %s\n' "$OUT_DIR"
