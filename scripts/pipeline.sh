#!/usr/bin/env bash
# pipeline.sh - Run full monorepo pipeline and sync registry to plugin
#
# Usage: pipeline.sh [options]
#   -f, --force       Force sync refresh (ignore cache)
#   -n, --no-cache    Disable detect cache
#   -t, --testing     Testing mode (isolated outputs)
#   -c, --commit      Commit plugin submodule pointer if changed
#   -d, --dry-run     Show what would be done without executing
#   -h, --help        Show this help
#
# This script:
#   1. Runs the registry pipeline (sync → detect → merge → build → bundle → validate)
#   2. Bundles registry.json to plugin/lua/theme-browser/data/
#   3. Optionally commits the plugin submodule pointer if changed
#
# Requirements: pnpm, git
#
# Examples:
#   ./scripts/pipeline.sh
#   ./scripts/pipeline.sh --force
#   ./scripts/pipeline.sh --commit
#   ./scripts/pipeline.sh --testing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

force=false
no_cache=false
testing=false
commit=false
dry_run=false

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

check_plugin_changed() {
	local plugin_dir="$ROOT_DIR/packages/plugin"
	if git -C "$ROOT_DIR" diff --quiet "$plugin_dir"; then
		return 1
	else
		return 0
	fi
}

commit_plugin_pointer() {
	if $dry_run; then
		log_dry "Commit plugin submodule pointer update"
		return 0
	fi

	if ! check_plugin_changed; then
		log "No plugin submodule changes to commit"
		return 0
	fi

	log "Committing plugin submodule pointer update"
	git -C "$ROOT_DIR" add packages/plugin
	git -C "$ROOT_DIR" commit -m "chore(plugin): update submodule pointer

Updated registry.json with latest theme data from pipeline."
	log_ok "Plugin submodule pointer committed"
}

main() {
	parse_args "$@"

	cd "$ROOT_DIR"

	log "Running monorepo pipeline"
	$dry_run && log "(dry run mode)"
	$testing && log "(testing mode)"

	local pipeline_args=()
	$force && pipeline_args+=("--force")
	$no_cache && pipeline_args+=("--no-cache")
	$testing && pipeline_args+=("--testing")

	log "Step 1/2: Run registry pipeline"
	if $dry_run; then
		log_dry "pnpm --filter @theme-browser/registry task:pipeline ${pipeline_args[*]}"
	else
		pnpm --filter @theme-browser/registry task:pipeline "${pipeline_args[@]}"
		log_ok "Registry pipeline complete"
	fi

	if $testing; then
		log_warn "Testing mode: skipping plugin submodule commit"
		return 0
	fi

	log "Step 2/2: Sync to plugin"
	if check_plugin_changed; then
		log_ok "Plugin data updated (registry.json bundled)"
		if $commit; then
			commit_plugin_pointer
		else
			log_warn "Plugin submodule has changes. Run with --commit to commit, or commit manually."
			log "To commit: git add packages/plugin && git commit -m 'chore(plugin): update submodule pointer'"
		fi
	else
		log_ok "No plugin changes detected"
	fi

	echo ""
	log_ok "Pipeline complete!"
	echo "Outputs:"
	echo "  - packages/registry/artifacts/themes.json"
	echo "  - packages/registry/artifacts/manifest.json"
	echo "  - packages/plugin/lua/theme-browser/data/registry.json"
}

main "$@"
