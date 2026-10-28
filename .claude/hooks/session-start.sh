#!/bin/bash
# Installs dependencies in Claude Code cloud sessions so lint, typecheck, tests
# and build work right away. Local sessions already have node_modules.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install instead of npm ci: it reuses node_modules from the cached
# container state instead of deleting it every time.
npm install --no-audit --no-fund
