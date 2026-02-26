#!/usr/bin/env bash
# release.sh - Create and push a new release
#
# Usage: release.sh <version> [options]
#   -d, --dry-run     Show what would be done without executing
#   -s, --skip-docs   Skip documentation checks (use if already updated)
#   -y, --yes         Skip confirmation prompt
#   -h, --help        Show this help
#
# Examples:
#   ./scripts/release.sh 0.2.0
#   ./scripts/release.sh 0.3.0 --dry-run
#   ./scripts/release.sh 0.3.0 --yes
#
# Requirements: git, npm, jq
#
# This script:
#   1. Validates version format and git state
#   2. Checks for CHANGELOG.md entry
#   3. Updates version in all package.json files
#   4. Runs format and lint checks
#   5. Commits version bump
#   6. Creates and pushes tags to all submodules
#   7. Pushes commits to all remotes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

dry_run=false
skip_docs=false
auto_confirm=false
version=""

usage() {
	sed -n 's/^# //p' "$0" | head -n 20
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
		log "$*"
		"$@"
	fi
}

validate_version() {
	local v="$1"
	if [[ ! "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		echo "error: version must be semver format (e.g., 0.2.0)" >&2
		exit 1
	fi
}

check_git_clean() {
	if ! git diff --quiet HEAD 2>/dev/null; then
		echo "error: uncommitted changes in $(pwd)" >&2
		git status --short
		exit 1
	fi
}

check_main_branch() {
	local branch
	branch=$(git rev-parse --abbrev-ref HEAD)
	if [[ "$branch" != "main" && "$branch" != "master" ]]; then
		echo "error: must be on main or master branch (currently on $branch)" >&2
		exit 1
	fi
}

tag_exists() {
	local tag="$1"
	git rev-parse "$tag" >/dev/null 2>&1
}

check_changelog() {
	local new_version="$1"
	local changelog="$ROOT_DIR/CHANGELOG.md"

	if [[ ! -f "$changelog" ]]; then
		log_warn "CHANGELOG.md not found at root"
		return 1
	fi

	if grep -q "## \[$new_version\]" "$changelog"; then
		log_ok "CHANGELOG.md has entry for $new_version"
		return 0
	else
		log_warn "CHANGELOG.md missing entry for $new_version"
		echo ""
		echo "Add an entry to CHANGELOG.md:"
		echo ""
		echo "## [$new_version] - $(date +%Y-%m-%d)"
		echo ""
		echo "### Added"
		echo "- ..."
		echo ""
		echo "### Changed"
		echo "- ..."
		echo ""
		echo "### Fixed"
		echo "- ..."
		echo ""
		return 1
	fi
}

get_current_version() {
	local pkg_json="$1"
	if [[ -f "$pkg_json" ]]; then
		jq -r '.version' "$pkg_json"
	else
		echo "unknown"
	fi
}

update_package_version() {
	local pkg_dir="$1"
	local new_version="$2"
	local pkg_json="$pkg_dir/package.json"

	if [[ -f "$pkg_json" ]]; then
		if $dry_run; then
			log_dry "Update $pkg_json to version $new_version"
		else
			local current
			current=$(get_current_version "$pkg_json")
			log "Bump $pkg_dir: $current → $new_version"
			jq --arg v "$new_version" '.version = $v' "$pkg_json" >"$pkg_json.tmp"
			mv "$pkg_json.tmp" "$pkg_json"
		fi
	fi
}

run_quality_checks() {
	local pkg_dir="$1"

	if $dry_run; then
		log_dry "Run quality checks in $pkg_dir"
		return 0
	fi

	pushd "$pkg_dir" >/dev/null

	if [[ -f "package.json" ]] && grep -q '"format:check"' package.json 2>/dev/null; then
		log "Running format:check..."
		npm run format:check || {
			log_warn "Format check failed. Run 'npm run format' to fix."
			popd >/dev/null
			return 1
		}
	fi

	if [[ -f "package.json" ]] && grep -q '"lint"' package.json 2>/dev/null; then
		log "Running lint..."
		npm run lint || {
			log_warn "Lint check failed."
			popd >/dev/null
			return 1
		}
	fi

	if [[ -f "package.json" ]] && grep -q '"typecheck"' package.json 2>/dev/null; then
		log "Running typecheck..."
		npm run typecheck || {
			log_warn "Typecheck failed."
			popd >/dev/null
			return 1
		}
	fi

	popd >/dev/null
}

commit_version_bump() {
	local msg="$1"
	if $dry_run; then
		log_dry "Commit: $msg"
	else
		git add -A
		git commit -m "$msg"
	fi
}

confirm() {
	local msg="$1"
	if $auto_confirm; then
		return 0
	fi
	echo ""
	read -r -p "$msg [y/N] " response
	case "$response" in
	[yY][eE][sS] | [yY]) return 0 ;;
	*) return 1 ;;
	esac
}

release_submodule() {
	local submodule_path="$1"
	local new_version="$2"
	local tag="v$new_version"

	log "--- Releasing $submodule_path ---"

	pushd "$ROOT_DIR/$submodule_path" >/dev/null

	check_git_clean
	check_main_branch

	if tag_exists "$tag"; then
		echo "error: tag $tag already exists in $submodule_path" >&2
		popd >/dev/null
		exit 1
	fi

	run_quality_checks "." || exit 1

	update_package_version "." "$new_version"
	commit_version_bump "chore(release): v$new_version"

	run git tag "$tag"
	run git push origin "$(git rev-parse --abbrev-ref HEAD)"
	run git push origin "$tag"

	popd >/dev/null
	log_ok "$submodule_path released"
}

release_root() {
	local new_version="$1"
	local tag="v$new_version"

	log "--- Releasing root ---"

	cd "$ROOT_DIR"

	check_git_clean
	check_main_branch

	if tag_exists "$tag"; then
		echo "error: tag $tag already exists" >&2
		exit 1
	fi

	if ! $skip_docs; then
		check_changelog "$new_version" || exit 1
	fi

	update_package_version "." "$new_version"

	git add packages/registry packages/plugin
	commit_version_bump "chore(release): v$new_version

Registry ($new_version):
- Version bump

Plugin:
- Version bump"

	run git tag "$tag"
	run git push origin "$(git rev-parse --abbrev-ref HEAD)"
	run git push origin "$tag"

	log_ok "root released"
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		-d | --dry-run)
			dry_run=true
			shift
			;;
		-s | --skip-docs)
			skip_docs=true
			shift
			;;
		-y | --yes)
			auto_confirm=true
			shift
			;;
		-h | --help) usage ;;
		--)
			shift
			break
			;;
		*) break ;;
		esac
	done

	version="${1:-}"
	if [[ -z "$version" ]]; then
		echo "error: version required" >&2
		usage
	fi

	validate_version "$version"
}

main() {
	parse_args "$@"

	cd "$ROOT_DIR"

	log "Releasing version $version"
	$dry_run && log "(dry run mode)"
	$skip_docs && log "(skipping docs check)"

	echo ""
	echo "Current versions:"
	echo "  root:     $(get_current_version "$ROOT_DIR/package.json")"
	echo "  registry: $(get_current_version "$ROOT_DIR/packages/registry/package.json")"
	echo "  plugin:   (lua, no package.json)"
	echo ""

	if ! $skip_docs; then
		check_changelog "$version" || exit 1
	fi

	confirm "Proceed with release $version?" || exit 0

	release_submodule "packages/registry" "$version"
	release_submodule "packages/plugin" "$version"
	release_root "$version"

	echo ""
	log_ok "Release $version complete!"
}

main "$@"
