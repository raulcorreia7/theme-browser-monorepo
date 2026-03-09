#!/usr/bin/env bash
# theme-browser-registry-refresh - clone the monorepo, refresh registry data, and optionally push changes
#
# Required env:
#   GITHUB_TOKEN
#   GIT_AUTHOR_NAME
#   GIT_AUTHOR_EMAIL
#
# Optional env:
#   GIT_AUTH_USER      default: git
#   MONOREPO_URL       default: https://github.com/raulcorreia7/theme-browser-monorepo.git
#   MONOREPO_BRANCH    default: master
#   REGISTRY_BRANCH    default: master
#   PLUGIN_BRANCH      default: main
#   PNPM_STORE_DIR     default: /var/lib/theme-browser-refresh/pnpm-store
#   WORK_ROOT          default: /var/lib/theme-browser-refresh
#   SKIP_PUSH          default: false
#   SKIP_SUBMODULE_UPDATE default: false
#
# Usage:
#   theme-browser-registry-refresh [--dry-run]

set -euo pipefail

dry_run=false
RUN_DIR=""

usage() {
	sed -n 's/^# //p' "$0" | head -n 19
	exit 0
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		--dry-run)
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

log() {
	printf '%s ► %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

log_ok() {
	printf '%s ✓ %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

log_dry() {
	printf '%s [DRY] ► %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

log_warn() {
	printf '%s ⚠ %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

log_error() {
	printf '%s error: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

require_env() {
	local key="$1"
	if [[ -z "${!key:-}" ]]; then
		log_error "missing required env: $key"
		exit 1
	fi
}

run() {
	if $dry_run; then
		log_dry "$*"
	else
		"$@"
	fi
}

run_in_dir() {
	local dir="$1"
	shift

	if $dry_run; then
		log_dry "(cd $dir && $*)"
	else
		(
			cd "$dir"
			"$@"
		)
	fi
}

has_changes() {
	local path="$1"
	[[ -n "$(git -C "$path" status --porcelain)" ]]
}

show_versions() {
	log "Runtime versions"
	printf '  node: %s\n' "$(node --version)"
	printf '  pnpm: %s\n' "$(pnpm --version)"
	printf '  git: %s\n' "$(git --version | awk '{print $3}')"
	printf '  nvim: %s\n' "$(nvim --version | head -n 1 | awk '{print $2}')"
}

show_config() {
	local monorepo_url="$1"
	local monorepo_branch="$2"
	local registry_branch="$3"
	local plugin_branch="$4"
	local work_root="$5"
	local pnpm_store_dir="$6"

	log "Run configuration"
	printf '  repo: %s\n' "$monorepo_url"
	printf '  branches: root=%s registry=%s plugin=%s\n' "$monorepo_branch" "$registry_branch" "$plugin_branch"
	printf '  work_root: %s\n' "$work_root"
	printf '  pnpm_store: %s\n' "$pnpm_store_dir"
	printf '  skip_push: %s\n' "${SKIP_PUSH:-false}"
	printf '  skip_submodule_update: %s\n' "${SKIP_SUBMODULE_UPDATE:-false}"
	printf '  dry_run: %s\n' "$dry_run"
}

cleanup() {
	if [[ -n "$RUN_DIR" && -d "$RUN_DIR" ]]; then
		log "Cleaning up workspace: $RUN_DIR"
		rm -rf "$RUN_DIR"
	fi
}

on_error() {
	local exit_code="$1"
	local line="$2"
	local command="$3"
	log_error "command failed at line $line (exit=$exit_code): $command"
}

prepare_branch() {
	local path="$1"
	local branch="$2"
	run git -C "$path" fetch origin "$branch"
	run git -C "$path" checkout -B "$branch" "origin/$branch"
}

commit_if_changed() {
	local path="$1"
	local message="$2"

	if ! has_changes "$path"; then
		log "No changes in $path"
		return 1
	fi

	log "Changes detected in $path"
	run git -C "$path" add -A
	run git -C "$path" commit -m "$message"
	return 0
}

push_branch() {
	local path="$1"
	local branch="$2"

	if [[ "${SKIP_PUSH:-false}" == "true" ]]; then
		log_dry "git -C $path push origin $branch"
		return 0
	fi

	log "Push $path -> origin/$branch"
	run git -C "$path" push origin "$branch"
}

main() {
	parse_args "$@"

	require_env GITHUB_TOKEN
	require_env GIT_AUTHOR_NAME
	require_env GIT_AUTHOR_EMAIL

	local auth_user="${GIT_AUTH_USER:-git}"
	local monorepo_url="${MONOREPO_URL:-https://github.com/raulcorreia7/theme-browser-monorepo.git}"
	local monorepo_branch="${MONOREPO_BRANCH:-master}"
	local registry_branch="${REGISTRY_BRANCH:-master}"
	local plugin_branch="${PLUGIN_BRANCH:-main}"
	local work_root="${WORK_ROOT:-/var/lib/theme-browser-refresh}"
	local pnpm_store_dir="${PNPM_STORE_DIR:-$work_root/pnpm-store}"

	trap 'on_error "$?" "$LINENO" "$BASH_COMMAND"' ERR
	trap cleanup EXIT

	mkdir -p "$work_root" "$pnpm_store_dir"
	RUN_DIR="$(mktemp -d "$work_root/run.XXXXXX")"

	git config --global user.name "$GIT_AUTHOR_NAME"
	git config --global user.email "$GIT_AUTHOR_EMAIL"
	git config --global url."https://${auth_user}:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"

	show_versions
	show_config "$monorepo_url" "$monorepo_branch" "$registry_branch" "$plugin_branch" "$work_root" "$pnpm_store_dir"

	log "Clone monorepo"
	run git clone --branch "$monorepo_branch" --recurse-submodules "$monorepo_url" "$RUN_DIR/repo"

	local repo_dir="$RUN_DIR/repo"

	log "Prepare branches"
	run git -C "$repo_dir" checkout "$monorepo_branch"
	prepare_branch "$repo_dir/packages/registry" "$registry_branch"
	prepare_branch "$repo_dir/packages/plugin" "$plugin_branch"

	if [[ "${SKIP_SUBMODULE_UPDATE:-false}" != "true" ]]; then
		log "Fast-forward submodules"
		run_in_dir "$repo_dir" bash ./scripts/update-submodules.sh
	fi

	log "Install dependencies"
	run_in_dir "$repo_dir" pnpm install --frozen-lockfile --store-dir "$pnpm_store_dir"

	log "Run pipeline"
	run_in_dir "$repo_dir" make pipeline

	log "Run verification"
	run_in_dir "$repo_dir" make verify

	if $dry_run; then
		log_ok "Dry run complete"
		return 0
	fi

	local registry_changed=false
	local plugin_changed=false

	if commit_if_changed "$repo_dir/packages/registry" "chore: refresh registry data"; then
		registry_changed=true
		push_branch "$repo_dir/packages/registry" "$registry_branch"
	fi

	if commit_if_changed "$repo_dir/packages/plugin" "chore: refresh bundled registry"; then
		plugin_changed=true
		push_branch "$repo_dir/packages/plugin" "$plugin_branch"
	fi

	if $registry_changed || $plugin_changed; then
		run git -C "$repo_dir" add packages/registry packages/plugin
	fi

	if commit_if_changed "$repo_dir" "chore: refresh submodule pointers"; then
		push_branch "$repo_dir" "$monorepo_branch"
	else
		log "No root changes to commit"
	fi

	log_ok "Refresh run complete"
}

main "$@"
