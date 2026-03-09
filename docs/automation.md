# Automation Runner

Use this guide for the scheduled job that refreshes registry data without
creating releases.

## Goal

Automate the data refresh workflow while keeping version bumps, tags, and
release publishing manual.

## Scope

The runner is intended to:

- update nested repos to their tracked branches
- regenerate registry artifacts
- rebuild the bundled plugin registry
- run workspace verification
- commit and push changed repos

The runner must not:

- call `make release`
- create tags
- publish GitHub releases

## Recommended Deployment

Start with one small Debian VM or LXC host that runs the refresh script directly
from a checked-out workspace on a `systemd` timer.

That keeps scheduling simple and avoids maintaining a container image before the
deployment shape settles.

If you already prefer containerized jobs, the repo still includes a Dockerfile
and image build helper. Treat that as an optional deployment path, not the
default operational model.

## Runtime Requirements

Host packages:

- `bash`, `ca-certificates`, `curl`, `git`, `openssh-client`
- `jq`, `ripgrep`, `lua5.1`, `neovim`
- `build-essential`, `make`, `python3`
- Node.js 20+
- pnpm 10+

These cover git operations, root `make` workflows, plugin verification, and
native Node modules such as `better-sqlite3`.

## Required Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GITHUB_TOKEN` | yes | - | GitHub clone, fetch, and push access |
| `GIT_AUTHOR_NAME` | yes | - | Commit author name |
| `GIT_AUTHOR_EMAIL` | yes | - | Commit author email |
| `GIT_AUTH_USER` | no | `git` | Username for authenticated GitHub HTTPS remotes |
| `MONOREPO_URL` | no | `https://github.com/raulcorreia7/theme-browser-monorepo.git` | Monorepo clone URL |
| `MONOREPO_BRANCH` | no | `master` | Root branch to refresh and push |
| `REGISTRY_BRANCH` | no | `master` | Registry submodule branch |
| `PLUGIN_BRANCH` | no | `main` | Plugin submodule branch |
| `PNPM_STORE_DIR` | no | `/var/lib/theme-browser-refresh/pnpm-store` | Shared pnpm store |
| `WORK_ROOT` | no | `/var/lib/theme-browser-refresh` | Job working directory |
| `SKIP_PUSH` | no | `false` | Keep commits local for dry operational testing |
| `SKIP_SUBMODULE_UPDATE` | no | `false` | Skip the submodule fast-forward step |

Recommended GitHub token scope: fine-grained `Contents: Read and write` access to
the monorepo, registry repo, and plugin repo.

## What The Runner Does

`scripts/registry-refresh.sh`:

1. clones the monorepo with submodules
2. checks out the configured root, registry, and plugin branches
3. fast-forwards submodules unless skipped
4. runs `pnpm install --frozen-lockfile`
5. runs `make refresh`
6. runs `make verify`
7. commits and pushes changed repos in this order:
   - `packages/registry` with `chore: refresh registry data`
   - `packages/plugin` with `chore: refresh bundled registry`
   - root repo with `chore: refresh submodule pointers`

## Run It Manually

### Host Workspace

Assume the workspace is checked out at `/opt/theme-browser-monorepo` on the host.

```bash
git clone --recurse-submodules https://github.com/raulcorreia7/theme-browser-monorepo.git /opt/theme-browser-monorepo
cd /opt/theme-browser-monorepo
pnpm install --frozen-lockfile
GITHUB_TOKEN=... \
GIT_AUTHOR_NAME="theme-browser bot" \
GIT_AUTHOR_EMAIL="bot@example.com" \
bash ./scripts/registry-refresh.sh
```

Dry run:

```bash
GITHUB_TOKEN=... \
GIT_AUTHOR_NAME="theme-browser bot" \
GIT_AUTHOR_EMAIL="bot@example.com" \
bash ./scripts/registry-refresh.sh --dry-run
```

### Optional Docker Image

Build the image from the checked-out workspace:

```bash
bash ./scripts/build-registry-dockerfile.sh
```

Run it manually:

```bash
docker run --rm \
  --env-file /etc/theme-browser/registry-refresh.env \
  -v /var/lib/theme-browser-refresh:/var/lib/theme-browser-refresh \
  theme-browser-registry-refresh:local
```

Dry run:

```bash
docker run --rm \
  --env-file /etc/theme-browser/registry-refresh.env \
  -v /var/lib/theme-browser-refresh:/var/lib/theme-browser-refresh \
  theme-browser-registry-refresh:local \
  --dry-run
```

## Scheduling

Preferred: `systemd` timer on the host.

The checked-out workspace path used by the examples is `/opt/theme-browser-monorepo`.

Fallbacks:

- host cron that runs the refresh script
- host scheduler that runs the Docker image instead
- another scheduler that invokes the same script with the same environment

Avoid converting this into a long-running service. Keep it as a short-lived
scheduled job.

## Failure Handling

Keep the first deployment simple:

- rely on the script exit code
- inspect `journalctl` or captured stdout/stderr logs
- for containerized runs, inspect `docker logs`
- add notifications later if the job proves stable and useful

## Related Files

- `workflows.md` - refresh vs release boundaries
- `../scripts/registry-refresh.sh` - runner entry point
- `../scripts/build-registry-dockerfile.sh` - optional image build helper
- `../docker/registry.Dockerfile` - optional runner image definition
- `../ops/examples/registry-refresh.env.example` - sample environment file
- `../ops/cron/theme-browser-registry-refresh.cron` - cron example
- `../ops/systemd/theme-browser-registry-refresh.service` - service unit
- `../ops/systemd/theme-browser-registry-refresh.timer` - timer unit
