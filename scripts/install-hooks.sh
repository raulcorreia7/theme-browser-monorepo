#!/usr/bin/env bash
# install-hooks.sh - Configure local git hooks for this workspace
#
# Usage: install-hooks.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_PATH="$ROOT_DIR/.githooks/pre-push"

if [[ ! -f "$HOOK_PATH" ]]; then
	echo "error: missing hook file: $HOOK_PATH" >&2
	exit 1
fi

git -C "$ROOT_DIR" config core.hooksPath .githooks
chmod +x "$HOOK_PATH"

echo "Configured git hooks at .githooks"
