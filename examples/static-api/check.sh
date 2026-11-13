#!/usr/bin/env bash
#
# Query the Ebb Static JSON API without installing any npm packages.
# Usage: ./check.sh [purl] [base_url]
#
set -euo pipefail

PURL="${1:-pkg:npm/request}"
BASE_URL="${2:-https://velella.sh/ebb/api/v1}"

# Check for local pre-built static API fallback if offline or during tests
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_API_DIR="${SCRIPT_DIR}/../../dist/site/api/v1"

echo "Querying Ebb Static API for: ${PURL}"

# Determine relative path from purl (e.g. pkg:npm/request -> npm/request.json)
CLEAN_PURL="${PURL#pkg:}"
TYPE="${CLEAN_PURL%%/*}"
NAME="${CLEAN_PURL#*/}"
NAME="${NAME%@*}"

API_PATH="${TYPE}/${NAME}.json"

if [ -f "${LOCAL_API_DIR}/${API_PATH}" ] && [ "${BASE_URL}" = "https://velella.sh/ebb/api/v1" ]; then
  echo "Reading from local static API build..."
  RESPONSE=$(cat "${LOCAL_API_DIR}/${API_PATH}")
elif command -v curl >/dev/null 2>&1; then
  TARGET_URL="${BASE_URL}/${API_PATH}"
  echo "Fetching: ${TARGET_URL}"
  RESPONSE=$(curl -fsSL "${TARGET_URL}" || true)
  if [ -z "${RESPONSE}" ]; then
    echo "Component not found or network unavailable for ${TARGET_URL}" >&2
    exit 1
  fi
else
  echo "Error: curl is required to query the remote static API." >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  echo "${RESPONSE}" | jq '{
    component: .name,
    type: .type,
    purl: .purl,
    rules: [.rules[] | { id: .id, event: .event, replacement: .replacement, deadline: .deadline }]
  }'
else
  echo "${RESPONSE}"
fi
