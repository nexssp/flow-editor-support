#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

npx --yes tree-sitter-cli generate grammar.js
for file in examples/complete.nflow test/fixtures/current-syntax.nflow; do
  output="$(npx --yes tree-sitter-cli parse "$file" 2>&1)" || {
    printf '%s\n' "$output" >&2
    exit 1
  }
  if grep -Eq '\(ERROR|\(MISSING' <<<"$output"; then
    printf 'Tree-sitter parse failed for %s:\n%s\n' "$file" "$output" >&2
    exit 1
  fi
  printf 'Tree-sitter accepted %s\n' "$file"
done

for query in \
  zed/languages/flow/highlights.scm \
  zed/languages/flow/brackets.scm \
  zed-legacy-0.230.2/languages/flow/highlights.scm \
  zed-legacy-0.230.2/languages/flow/brackets.scm; do
  output="$(npx --yes tree-sitter-cli query "$query" test/fixtures/current-syntax.nflow 2>&1)" || {
    printf 'Tree-sitter query failed for %s:\n%s\n' "$query" "$output" >&2
    exit 1
  }
  if grep -Eqi 'query error|unknown node type|invalid node type' <<<"$output"; then
    printf 'Tree-sitter query reported an error for %s:\n%s\n' "$query" "$output" >&2
    exit 1
  fi
  printf 'Tree-sitter query accepted %s\n' "$query"
done
