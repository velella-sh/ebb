#!/bin/sh
set -e

TARGET="${1:-.}"
EBB_CMD="${EBB_BIN:-npx --yes @velella/ebb@0.2.1}"

if [ -f "$TARGET" ] || [ -d "$TARGET" ]; then
  SCAN_TYPE="fs"
else
  SCAN_TYPE="image"
fi

# Run Trivy with full package listing and pipe into Ebb bridge
trivy "$SCAN_TYPE" "$TARGET" --format json --list-all-pkgs | $EBB_CMD bridge trivy -
