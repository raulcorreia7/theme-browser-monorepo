#!/usr/bin/env bash
# refresh.sh - Run the monorepo refresh flow and optionally commit plugin refresh changes
#
# Usage: refresh.sh [options]
#   -f, --force       Force sync refresh (ignore cache)
#   -n, --no-cache    Disable detect cache
#   -t, --testing     Testing mode (isolated outputs)
#   -c, --commit      Commit plugin refresh in the submodule and stage the root pointer update
#   -d, --dry-run     Show what would be done without executing
#   -h, --help        Show this help
#
# This script:
#   1. Runs the registry package refresh flow
#   2. Checks whether the plugin bundled registry changed
#   3. Optionally commits the plugin refresh and the root submodule pointer update
#
# Requirements: pnpm, git
#
# Examples:
#   ./scripts/refresh.sh
#   ./scripts/refresh.sh --force
#   ./scripts/refresh.sh --commit
#   ./scripts/refresh.sh --testing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

force=false
no_cache=false
testing=false
commit=false
dry_run=false
PLUGIN_DIR="$ROOT_DIR/packages/plugin"
PLUGIN_REGISTRY_PATH="lua/theme-browser/data/registry.json"

usage() {
	sed -n 's/^# //p' "$0" | head -n 22
	exit 0
}

log() {
	echo "► $*"
}

log_dry() {
	echo "[DRY] ► $*"
}

log_ok() {
	echo "✓ $*"
}

log_warn() {
	echo "⚠ $*" >&2
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		-f | --force)
			force=true
			shift
			;;
		-n | --no-cache)
			no_cache=true
			shift
			;;
		-t | --testing)
			testing=true
			shift
			;;
		-c | --commit)
			commit=true
			shift
			;;
		-d | --dry-run)
			dry_run=true
			shift
			;;
		-h | --help)
			usage
			;;
		--)
			shift
			break
			;;
		*)
			break
			;;
		esac
	done
}

extract_status_path() {
	local line="$1"
	local path="${line:3}"
	if [[ "$path" == *" -> "* ]]; then
		path="${path##* -> }"
	fi
	echo "$path"
}

list_unexpected_changes() {
	local repo_path="$1"
	shift
	local allowed_paths=("$@")
	local line

	while IFS= read -r line; do
		[[ -z "$line" ]] && continue
		local path
		local allowed=false
		path="$(extract_status_path "$line")"

		for allowed_path in "${allowed_paths[@]}"; do
			if [[ "$path" == "$allowed_path" ]]; then
				allowed=true
				break
			fi
		done

		if ! $allowed; then
			echo "$line"
		fi
	done < <(git -C "$repo_path" status --porcelain --untracked-files=all)
}

plugin_registry_changed() {
	[[ -n "$(git -C "$PLUGIN_DIR" status --porcelain -- "$PLUGIN_REGISTRY_PATH")" ]]
}

root_plugin_pointer_changed() {
	[[ -n "$(git -C "$ROOT_DIR" status --porcelain -- packages/plugin)" ]]
}

commit_plugin_refresh() {
	if $dry_run; then
		log_dry "Commit plugin refresh in packages/plugin"
		log_dry "Commit root submodule pointer update"
		return 0
	fi

	if ! plugin_registry_changed; then
		log "No plugin registry changes to commit"
		return 0
	fi

	local plugin_unexpected_changes
	plugin_unexpected_changes="$(list_unexpected_changes "$PLUGIN_DIR" "$PLUGIN_REGISTRY_PATH")"
	if [[ -n "$plugin_unexpected_changes" ]]; then
		echo "error: packages/plugin has unrelated changes; commit manually:" >&2
		echo "$plugin_unexpected_changes" >&2
		exit 1
	fi

	log "Committing bundled registry refresh in packages/plugin"
	git -C "$PLUGIN_DIR" add -- "$PLUGIN_REGISTRY_PATH"
	git -C "$PLUGIN_DIR" commit -m "chore: refresh bundled registry"
	log_ok "Plugin refresh committed"

	local root_unexpected_changes
	root_unexpected_changes="$(list_unexpected_changes "$ROOT_DIR" "packages/plugin")"
	if [[ -n "$root_unexpected_changes" ]]; then
		log_warn "Root repo has unrelated changes; leaving submodule pointer commit for manual review"
		echo "$root_unexpected_changes" >&2
		return 0
	fi

	if ! root_plugin_pointer_changed; then
		log "No root submodule pointer changes to commit"
		return 0
	fi

	log "Committing root submodule pointer update"
	git -C "$ROOT_DIR" add -- packages/plugin
	git -C "$ROOT_DIR" commit -m "chore(plugin): update submodule pointer"
	log_ok "Root submodule pointer committed"
}

main() {
	parse_args "$@"

	cd "$ROOT_DIR"

	log "Running monorepo refresh"
	$dry_run && log "(dry run mode)"
	$testing && log "(testing mode)"

	local pipeline_args=()
	$force && pipeline_args+=("--force")
	$no_cache && pipeline_args+=("--no-cache")
	$testing && pipeline_args+=("--testing")

	log "Step 1/2: Run registry refresh"
	if $dry_run; then
		log_dry "pnpm --filter @theme-browser/registry pipeline ${pipeline_args[*]}"
	else
		pnpm --filter @theme-browser/registry pipeline "${pipeline_args[@]}"
		log_ok "Registry refresh complete"
	fi

	if $testing; then
		log_warn "Testing mode: skipping plugin refresh commit"
		return 0
	fi

	log "Step 2/2: Review plugin refresh"
	if plugin_registry_changed; then
		log_ok "Plugin data updated (registry.json bundled)"
		if $commit; then
			commit_plugin_refresh
		else
			log_warn "Plugin repo has bundled registry changes. Run with --commit, or commit manually."
			log "Manual flow: commit packages/plugin first, then commit the root packages/plugin pointer"
		fi
	else
		log_ok "No plugin changes detected"
	fi

	echo ""
	log_ok "Refresh complete!"
	echo "Outputs:"
	echo "  - packages/registry/artifacts/themes.json"
	echo "  - packages/registry/artifacts/manifest.json"
	echo "  - packages/plugin/lua/theme-browser/data/registry.json"
}

main "$@"
