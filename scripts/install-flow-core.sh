#!/usr/bin/env bash
set -euo pipefail
# Pinned core used by CI and real-provider smoke tests. The v0.67.0 source tag is
# public but has no published binary assets yet, so build its CLI from the Go module.
VERSION=0.67.0
FLOW_MODULE=github.com/nexssp/flow/cmd/nflow
# Separate launcher compatibility floor; this does not imply newer LSP features.
MINIMUM_VERSION=0.44.2

usage() {
  echo "Usage: $0 [install [INSTALL_DIR] | --check]" >&2
}

resolve_binary() {
  local requested="$1"
  if [[ "$requested" == */* ]]; then
    printf '%s\n' "$requested"
  else
    command -v -- "$requested" || return 1
  fi
}

verify_binary() {
  local candidate="$1"
  local resolved version_output version_match actual_major actual_minor actual_patch
  if ! resolved="$(resolve_binary "$candidate")" || [[ ! -x "$resolved" ]]; then
    echo "Flow core v${MINIMUM_VERSION} or newer is required, but the configured nflow executable is missing or not executable: $candidate" >&2
    echo "Install it with 'bash scripts/install-flow-core.sh install' or set NFLOW_BIN to a verified Flow executable." >&2
    return 1
  fi
  if ! version_output="$("$resolved" --version 2>&1)"; then
    echo "Could not run the configured nflow executable: $resolved" >&2
    printf '%s\n' "$version_output" >&2
    return 1
  fi
  if [[ ! "$version_output" =~ version:[[:space:]]+v?([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    echo "Could not read the Flow version from '$resolved --version':" >&2
    printf '%s\n' "$version_output" >&2
    return 1
  fi
  version_match="${BASH_REMATCH[0]}"
  actual_major="${BASH_REMATCH[1]}"
  actual_minor="${BASH_REMATCH[2]}"
  actual_patch="${BASH_REMATCH[3]}"
  if (( actual_major < 0 || (actual_major == 0 && actual_minor < 44) || (actual_major == 0 && actual_minor == 44 && actual_patch < 2) )); then
    echo "Flow core v${MINIMUM_VERSION} or newer is required, but '$resolved --version' reported ${version_match#*version: }." >&2
    return 1
  fi
  printf '%s\n' "$resolved"
}

emit_environment() {
  local binary="$1"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    {
      printf 'NFLOW_BIN=%s\n' "$binary"
    } >> "$GITHUB_ENV"
  fi
  printf 'export NFLOW_BIN=%q\n' "$binary"
}

MODE="${1:-install}"
if [[ "$MODE" == "--check" ]]; then
  if [[ $# -gt 2 ]]; then usage; exit 2; fi
  # NFLOW_BIN is canonical; old names remain accepted as input fallbacks.
  candidate="${2:-${NFLOW_BIN:-${FLOW_NFLOW_LSP_BIN:-${FLOW_NFLOW_BIN:-nflow}}}}"
  verified="$(verify_binary "$candidate")"
  emit_environment "$verified"
  exit 0
fi

if [[ "$MODE" != "install" || $# -gt 2 ]]; then
  usage
  exit 2
fi
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "The pinned source installer supports Linux amd64 runners only." >&2
  exit 2
fi
if ! command -v go >/dev/null 2>&1; then
  echo "Go 1.27.3 or newer is required to build Flow v${VERSION} from its source tag." >&2
  exit 1
fi

INSTALL_DIR="${2:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/nflow-v${VERSION}}"
mkdir -p "$INSTALL_DIR"
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"
GOTOOLCHAIN=auto GOBIN="$INSTALL_DIR" go install "${FLOW_MODULE}@v${VERSION}"
verified="$(verify_binary "$INSTALL_DIR/nflow")"
version_output="$("$verified" --version 2>&1)"
exact_version_pattern="version:[[:space:]]+v?${VERSION//./\\.}([[:space:]]|$)"
if [[ ! "$version_output" =~ $exact_version_pattern ]]; then
  echo "Built Flow CLI did not report the pinned v${VERSION}:" >&2
  printf '%s\n' "$version_output" >&2
  exit 1
fi
echo "Built and verified Flow core v${VERSION} from ${FLOW_MODULE}@v${VERSION} at $verified" >&2
emit_environment "$verified"
