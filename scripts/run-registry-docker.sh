#!/usr/bin/env bash
# run-registry-docker.sh - Run the registry refresh Docker image
#
# Usage:
#   run-registry-docker.sh [OPTIONS] [-- extra-args]
#
# Options:
#   -i, --image TAG        Docker image tag (default: theme-browser-registry-refresh:local)
#   -e, --env-file FILE    Environment file path (default: /etc/theme-browser/registry-refresh.env)
#   -w, --work-root DIR    Host work root to mount (default: /var/lib/theme-browser-refresh)
#   -n, --name NAME        Container name (default: theme-browser-registry-refresh)
#   -d, --dry-run          Pass --dry-run to the container command
#   --skip-push            Override env with SKIP_PUSH=true
#   --skip-submodule-update Override env with SKIP_SUBMODULE_UPDATE=true
#   -h, --help             Show this help
#
# Examples:
#   ./scripts/run-registry-docker.sh
#   ./scripts/run-registry-docker.sh --dry-run
#   ./scripts/run-registry-docker.sh --image theme-browser-registry-refresh:ci
#   ./scripts/run-registry-docker.sh --skip-push

set -euo pipefail

IMAGE_TAG="theme-browser-registry-refresh:local"
ENV_FILE="/etc/theme-browser/registry-refresh.env"
WORK_ROOT="/var/lib/theme-browser-refresh"
CONTAINER_NAME="theme-browser-registry-refresh"
SCRIPT_ARGS=()
ENV_OVERRIDES=()

usage() {
	sed -n 's/^# //p' "$0" | head -n 20
	exit 0
}

require_file() {
	local path="$1"
	local label="$2"

	if [[ ! -f "$path" ]]; then
		echo "error: missing $label: $path" >&2
		exit 1
	fi
}

require_directory() {
	local path="$1"
	local label="$2"

	if [[ ! -d "$path" ]]; then
		echo "error: missing $label: $path" >&2
		exit 1
	fi
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		-i | --image)
			IMAGE_TAG="$2"
			shift 2
			;;
		-e | --env-file)
			ENV_FILE="$2"
			shift 2
			;;
		-w | --work-root)
			WORK_ROOT="$2"
			shift 2
			;;
		-n | --name)
			CONTAINER_NAME="$2"
			shift 2
			;;
		-d | --dry-run)
			SCRIPT_ARGS+=("--dry-run")
			shift
			;;
		--skip-push)
			ENV_OVERRIDES+=("-e" "SKIP_PUSH=true")
			shift
			;;
		--skip-submodule-update)
			ENV_OVERRIDES+=("-e" "SKIP_SUBMODULE_UPDATE=true")
			shift
			;;
		-h | --help)
			usage
			;;
		--)
			shift
			if [[ "$#" -gt 0 ]]; then
				echo "error: extra arguments are not supported; use env-style options such as --skip-push" >&2
				exit 1
			fi
			break
			;;
		*)
			echo "error: unknown option: $1" >&2
			exit 1
			;;
		esac
	done
}

main() {
	parse_args "$@"

	require_file "$ENV_FILE" "env file"
	require_directory "$WORK_ROOT" "work root"

	echo "► Running $IMAGE_TAG"
	docker run --rm \
		--name "$CONTAINER_NAME" \
		--env-file "$ENV_FILE" \
		"${ENV_OVERRIDES[@]}" \
		-v "$WORK_ROOT:$WORK_ROOT" \
		"$IMAGE_TAG" \
		"${SCRIPT_ARGS[@]}"
}

main "$@"
