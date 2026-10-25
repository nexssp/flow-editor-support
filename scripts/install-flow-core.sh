#!/usr/bin/env bash
set -euo pipefail

VERSION=0.44.2
MINIMUM_VERSION=0.44.2
ASSET="nflow_${VERSION}_linux_amd64.tar.gz"
MANIFEST="nflow_${VERSION}_checksums.txt"
RELEASE_URL="https://github.com/nexssp/flow/releases/download/v${VERSION}"
EXPECTED_MANIFEST_SHA256=21d006367ad5b3584765f7908552c4f9846055bdaf72e99858928609ee711626

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
      printf 'FLOW_NFLOW_BIN=%s\n' "$binary"
      printf 'FLOW_NFLOW_LSP_BIN=%s\n' "$binary"
    } >> "$GITHUB_ENV"
  fi
  printf 'export NFLOW_BIN=%q\n' "$binary"
  printf 'export FLOW_NFLOW_BIN=%q\n' "$binary"
  printf 'export FLOW_NFLOW_LSP_BIN=%q\n' "$binary"
}

MODE="${1:-install}"
if [[ "$MODE" == "--check" ]]; then
  if [[ $# -gt 2 ]]; then usage; exit 2; fi
  candidate="${2:-${FLOW_NFLOW_BIN:-${NFLOW_BIN:-nflow}}}"
  verified="$(verify_binary "$candidate")"
  emit_environment "$verified"
  exit 0
fi

if [[ "$MODE" != "install" || $# -gt 2 ]]; then
  usage
  exit 2
fi
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "The pinned release installer supports Linux amd64 runners only." >&2
  exit 2
fi

INSTALL_DIR="${2:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/nflow-v${VERSION}}"
mkdir -p "$INSTALL_DIR"
curl --fail --location --retry 3 --silent --show-error \
  --output "$INSTALL_DIR/$ASSET" "$RELEASE_URL/$ASSET"
curl --fail --location --retry 3 --silent --show-error \
  --output "$INSTALL_DIR/$MANIFEST" "$RELEASE_URL/$MANIFEST"
if ! printf '%s  %s\n' "$EXPECTED_MANIFEST_SHA256" "$INSTALL_DIR/$MANIFEST" | sha256sum --check --status; then
  echo "Official Flow v${VERSION} checksum manifest SHA-256 did not match the pinned digest." >&2
  exit 1
fi
if ! awk -v asset="$ASSET" '$2 == asset && length($1) == 64 { found++ } END { exit !(found == 1) }' "$INSTALL_DIR/$MANIFEST"; then
  echo "Official checksum manifest has no unique SHA-256 entry for $ASSET" >&2
  exit 1
fi
if ! (cd "$INSTALL_DIR" && sha256sum --check --ignore-missing "$MANIFEST"); then
  echo "Flow v${VERSION} Linux amd64 archive failed its official checksum check." >&2
  exit 1
fi
if ! tar -tzf "$INSTALL_DIR/$ASSET" | grep -Fxq nflow; then
  echo "Flow v${VERSION} archive does not contain the expected nflow executable." >&2
  exit 1
fi
tar -xzf "$INSTALL_DIR/$ASSET" -C "$INSTALL_DIR" nflow
chmod +x "$INSTALL_DIR/nflow"
verified="$(verify_binary "$INSTALL_DIR/nflow")"
echo "Installed and verified Flow core v${VERSION} at $verified" >&2
emit_environment "$verified"
