#!/bin/sh
set -e

TARGET="${1:-.}"
EBB_CMD="${EBB_BIN:-npx --yes @velella/ebb@0.2.1}"

# Scan target with Grype and bridge to Ebb
grype "$TARGET" -o json | $EBB_CMD bridge grype -
