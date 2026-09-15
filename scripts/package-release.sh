#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-dist}"
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT/LICENSE" "$ROOT/vscode/LICENSE"
mkdir -p "$ROOT/vscode/lsp"
cp "$ROOT/lsp/flow-language-server.js" "$ROOT/vscode/lsp/flow-language-server.js"

(cd "$ROOT" && zip -qr "$ROOT/$OUT/nexss-flow-source.zip" README.md LICENSE examples lsp zed vscode notepadpp scripts/validate.py .zed .github)
(cd "$ROOT/zed" && zip -qr "$ROOT/$OUT/nexss-flow-zed.zip" .)
(cd "$ROOT/notepadpp" && zip -qr "$ROOT/$OUT/nexss-flow-notepadpp.zip" .)

if command -v npx >/dev/null 2>&1; then
  (cd "$ROOT/vscode" && npx --yes @vscode/vsce package --out "$ROOT/$OUT/nexss-flow-vscode.vsix" --no-dependencies)
else
  echo "npx is required to build the VS Code VSIX" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT"/* > "$OUT/SHA256SUMS"
else
  shasum -a 256 "$OUT"/* > "$OUT/SHA256SUMS"
fi
printf 'Packaged editor artifacts in %s\n' "$OUT"
