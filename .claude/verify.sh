#!/usr/bin/env bash
set -uo pipefail
# Check if only docs changed
STAGED=$(git diff --cached --name-only 2>/dev/null)
DOCS_ONLY=true
for f in $STAGED; do
  case "$f" in
    *.md|*.txt|.env.example|LICENSE|.gitignore|docs/*) ;;
    *) DOCS_ONLY=false; break ;;
  esac
done
if [ "$DOCS_ONLY" = true ]; then
  echo "Docs-only changes, skipping test gate."
  exit 0
fi
npm test 2>&1
