#!/usr/bin/env bash
# Retrieve optional GitHub inputs. The generator only reads the resulting local files.
set -euo pipefail

inputs=$1
mkdir -p "$inputs"
if [ -z "${GH_TOKEN:-}" ]; then
  exit 0
fi

if gh api --paginate --slurp \
  "repos/$GITHUB_REPOSITORY/issues?state=open&labels=new-product&per_page=100" \
  | jq 'add | map(select(.pull_request == null) | {number, title, body})' > "$inputs/requests.tmp"; then
  mv "$inputs/requests.tmp" "$inputs/requests.json"
else
  echo "Open product requests could not be read."
  rm -f "$inputs/requests.tmp"
fi

# Select the newest actual archive, even if a more recent workflow run was a dated preview.
if latest=$(gh api --paginate --slurp \
  "repos/$GITHUB_REPOSITORY/actions/artifacts?name=ebb-coverage-history&per_page=100" \
  | jq -r '[.[] | .artifacts[] | select(.expired == false and .workflow_run.head_branch == "main")] | max_by(.id) | .workflow_run.id // empty'); then
  if [ -n "$latest" ]; then
    gh run download "$latest" --repo "$GITHUB_REPOSITORY" --name ebb-coverage-history --dir "$inputs/prior"
  fi
else
  echo "Coverage archives could not be read. Use the checked-in history."
fi
