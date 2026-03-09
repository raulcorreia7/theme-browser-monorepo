#!/usr/bin/env bash
# verify-versioning.sh - Check release metadata and cross-repo version alignment
#
# Usage: verify-versioning.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

failures=0

log_ok() {
	echo "✓ $*"
}

log_fail() {
	echo "error: $*" >&2
	failures=$((failures + 1))
}

require_file() {
	local path="$1"
	if [[ ! -f "$path" ]]; then
		log_fail "missing file: $path"
		return 1
	fi
	return 0
}

ensure_gitmodules_entries() {
	local gitmodules="$ROOT_DIR/.gitmodules"
	if [[ ! -f "$gitmodules" ]]; then
		log_fail ".gitmodules is missing"
		return
	fi

	if grep -q 'submodule "packages/plugin"' "$gitmodules" &&
		grep -q 'submodule "packages/registry"' "$gitmodules"; then
		log_ok ".gitmodules declares plugin and registry submodules"
	else
		log_fail ".gitmodules is missing plugin or registry submodule entries"
	fi
}

extract_json_version() {
	local path="$1"
	jq -r '.version // empty' "$path"
}

extract_plugin_compatibility() {
	sed -n 's/^local COMPATIBLE_VERSION = "\(.*\)"$/\1/p' \
		"$ROOT_DIR/packages/plugin/lua/theme-browser/registry/sync.lua"
}

ensure_changelog_entry() {
	local path="$1"
	local version="$2"
	local label="$3"

	if grep -q "## \[$version\]" "$path"; then
		log_ok "$label changelog has entry for $version"
	else
		log_fail "$label changelog missing entry for $version ($path)"
	fi
}

ensure_no_legacy_release_script_refs() {
	local matches
	matches="$(rg -n 'scripts/version\.sh' "$ROOT_DIR/README.md" "$ROOT_DIR/docs" || true)"
	if [[ -n "$matches" ]]; then
		log_fail "legacy scripts/version.sh references remain:\n$matches"
	else
		log_ok "release docs reference scripts/release.sh"
	fi
}

main() {
	require_file "$ROOT_DIR/package.json" || true
	require_file "$ROOT_DIR/packages/registry/package.json" || true
	require_file "$ROOT_DIR/CHANGELOG.md" || true
	require_file "$ROOT_DIR/packages/plugin/CHANGELOG.md" || true
	require_file "$ROOT_DIR/packages/plugin/lua/theme-browser/registry/sync.lua" || true
	ensure_gitmodules_entries

	if [[ "$failures" -ne 0 ]]; then
		echo "" >&2
		echo "verify-versioning: $failures issue(s) found" >&2
		exit 1
	fi

	local root_version
	local registry_version
	local plugin_compatibility
	local registry_series

	root_version="$(extract_json_version "$ROOT_DIR/package.json")"
	registry_version="$(extract_json_version "$ROOT_DIR/packages/registry/package.json")"
	plugin_compatibility="$(extract_plugin_compatibility)"
	registry_series="${registry_version%.*}"

	if [[ -z "$root_version" ]]; then
		log_fail "root package.json is missing a version"
	else
		log_ok "root version: $root_version"
	fi

	if [[ -z "$registry_version" ]]; then
		log_fail "registry package.json is missing a version"
	else
		log_ok "registry version: $registry_version"
	fi

	if [[ "$root_version" == "$registry_version" && -n "$root_version" ]]; then
		log_ok "root and registry package versions are aligned"
	else
		log_fail "root version ($root_version) and registry version ($registry_version) differ"
	fi

	if [[ -n "$plugin_compatibility" && "$plugin_compatibility" == "$registry_series" ]]; then
		log_ok "plugin compatibility series matches registry series ($plugin_compatibility)"
	else
		log_fail "plugin compatibility series ($plugin_compatibility) does not match registry series ($registry_series)"
	fi

	if [[ -n "$root_version" ]]; then
		ensure_changelog_entry "$ROOT_DIR/CHANGELOG.md" "$root_version" "root"
		ensure_changelog_entry "$ROOT_DIR/packages/plugin/CHANGELOG.md" "$root_version" "plugin"
	fi

	ensure_no_legacy_release_script_refs

	if [[ "$failures" -ne 0 ]]; then
		echo "" >&2
		echo "verify-versioning: $failures issue(s) found" >&2
		exit 1
	fi

	echo ""
	log_ok "versioning metadata is consistent"
}

main "$@"
