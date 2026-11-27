#!/bin/sh
set -e

# Pinned Ebb invocation (supports local override via EBB_BIN)
EBB_CMD="${EBB_BIN:-npx --yes @velella/ebb@0.2.1}"

# Run trivy with --format json and --list-all-pkgs, then pipe into ebb bridge trivy
trivy "$@" --format json --list-all-pkgs | $EBB_CMD bridge trivy -
