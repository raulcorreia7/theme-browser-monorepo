#!/usr/bin/env bash
# update-submodules.sh - Fast-forward nested repos and stage updated pointers
#
# Usage: update-submodules.sh [options]
#   -n, --dry-run   Show what would be done without making changes
#   -h, --help      Show this help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
dry_run=false

submodules=(
	"packages/plugin"
	"packages/registry"
)

log() {
	echo "► $*"
}

log_ok() {
	echo "✓ $*"
}

log_dry() {
	echo "[DRY] ► $*"
}

usage() {
	sed -n 's/^# //p' "$0" | head -n 6
	exit 0
}

run() {
	if $dry_run; then
		log_dry "$*"
	else
		"$@"
	fi
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		-n | --dry-run)
			dry_run=true
			shift
			;;
		-h | --help)
			usage
			;;
		*)
			echo "error: unknown option: $1" >&2
			exit 1
			;;
		esac
	done
}

require_clean_repo() {
	local path="$1"
	if ! git -C "$path" diff --quiet HEAD 2>/dev/null; then
		echo "error: uncommitted changes in $path" >&2
		git -C "$path" status --short
		exit 1
	fi
}

require_branch_checkout() {
	local path="$1"
	local branch
	branch="$(git -C "$path" symbolic-ref --quiet --short HEAD || true)"
	if [[ -z "$branch" ]]; then
		echo "error: $path is in detached HEAD state" >&2
		exit 1
	fi
	echo "$branch"
}

main() {
	parse_args "$@"
	cd "$ROOT_DIR"

	log "Sync submodule metadata"
	run git submodule sync --recursive
	run git submodule update --init --recursive

	for path in "${submodules[@]}"; do
		require_clean_repo "$ROOT_DIR/$path"
		local branch
		branch="$(require_branch_checkout "$ROOT_DIR/$path")"

		log "Update $path on $branch"
		run git -C "$ROOT_DIR/$path" fetch origin "$branch"
		run git -C "$ROOT_DIR/$path" pull --ff-only origin "$branch"
		log_ok "$path updated"
	done

	log "Stage updated submodule pointers"
	run git add "${submodules[@]}"

	echo ""
	log_ok "submodules are up to date"
	if $dry_run; then
		log_dry "git status --short ${submodules[*]}"
	else
		git status --short "${submodules[@]}"
	fi
}

main "$@"
