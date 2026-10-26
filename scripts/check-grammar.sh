#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

npx --yes tree-sitter-cli generate grammar.js
for file in examples/complete.nflow test/fixtures/current-syntax.nflow \
  test/fixtures/template-render-input.nflow test/fixtures/template-render-contexts.nflow \
  test/fixtures/python-inline.nflow test/fixtures/embedded-languages.nflow; do
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
  zed-legacy-0.230.2/languages/flow/highlights.scm; do
  sample_output="$(npx --yes tree-sitter-cli query "$query" test/fixtures/template-render-input.nflow 2>&1)" || {
    printf 'Tree-sitter query failed for %s on the supplied sample:\n%s\n' "$query" "$sample_output" >&2
    exit 1
  }
  for capture in 'keyword.control' 'text: `range`' 'text: `end`' 'text: `.customer`' \
    'text: `.items`' 'text: `.`' 'punctuation.special'; do
    grep -Fq "$capture" <<<"$sample_output" || {
      printf 'Expected capture %s is missing from %s sample output:\n%s\n' "$capture" "$query" "$sample_output" >&2
      exit 1
    }
  done
  context_output="$(npx --yes tree-sitter-cli query "$query" test/fixtures/template-render-contexts.nflow 2>&1)" || {
    printf 'Tree-sitter query failed for %s on context fixture:\n%s\n' "$query" "$context_output" >&2
    exit 1
  }
  grep -Fq 'text: `.visible`' <<<"$context_output" || {
    printf 'The render template variable was not captured by %s:\n%s\n' "$query" "$context_output" >&2
    exit 1
  }
  if grep -Fq 'text: `.ignored`' <<<"$context_output"; then
    printf 'Ordinary or nested strings were incorrectly treated as Go templates by %s:\n%s\n' "$query" "$context_output" >&2
    exit 1
  fi
  printf 'Tree-sitter template captures are scoped correctly in %s\n' "$query"
done

for query in zed/languages/flow/highlights.scm zed-legacy-0.230.2/languages/flow/highlights.scm; do
  python_output="$(npx --yes tree-sitter-cli query "$query" test/fixtures/python-inline.nflow 2>&1)" || {
    printf 'Tree-sitter Python-injection query failed for %s:\n%s\n' "$query" "$python_output" >&2
    exit 1
  }
  grep -Fq 'injection.content' <<<"$python_output" || {
    printf 'Python injection content was not captured by %s:\n%s\n' "$query" "$python_output" >&2
    exit 1
  }
  grep -Eq 'capture: injection.content, start: \(2, 31\), end: \([0-9]+, 0\)' <<<"$python_output" || {
    printf 'Python injection did not capture only the block body in %s:\n%s\n' "$query" "$python_output" >&2
    exit 1
  }
  printf 'Tree-sitter Python injection is scoped correctly in %s\n' "$query"
done

for query in zed/languages/flow/highlights.scm zed-legacy-0.230.2/languages/flow/highlights.scm; do
  embedded_output="$(npx --yes tree-sitter-cli query "$query" test/fixtures/embedded-languages.nflow 2>&1)" || {
    printf 'Tree-sitter embedded-language query failed for %s:\n%s\n' "$query" "$embedded_output" >&2
    exit 1
  }
  injection_count="$(grep -c 'injection.content' <<<"$embedded_output" || true)"
  if (( injection_count < 11 )); then
    printf 'Expected 11 embedded-language body captures in %s, found %s:\n%s\n' "$query" "$injection_count" "$embedded_output" >&2
    exit 1
  fi
  printf 'Tree-sitter embedded-language injections are scoped correctly in %s\n' "$query"
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
