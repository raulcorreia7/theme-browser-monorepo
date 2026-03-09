# Automation Runner

## Goal

Run the registry refresh on a schedule without automating releases.

The intended automation scope is:

- update nested repos to their latest tracked branches
- regenerate registry artifacts
- rebuild the bundled plugin registry
- verify the workspace state
- commit and push changed repos

The intended non-goal is:

- no automatic `make version`
- no automatic tagging or release publishing

## Path Of Least Resistance

Recommended first deployment:

- one small Debian VM or LXC on Proxmox
- Docker installed on that host
- a short-lived container job built from `node:lts-trixie-slim`
- scheduling via `systemd timer`

This is simpler than running cron inside the container and simpler than introducing Dokploy if this is your only scheduled job.

## Runtime Requirements

Container base:

- `node:lts-trixie-slim`

System packages installed in the image:

- shell and transport:
- `bash`
- `ca-certificates`
- `curl`
- `git`
- `openssh-client`

- verification and tooling:
- `jq`
- `ripgrep`
- `lua5.1`
- `neovim`

- build/runtime dependencies:
- `build-essential`
- `make`
- `python3`

Why these are included:

- `git` and `openssh-client` for clone, submodule, and push operations
- `make` for the root workflow
- `jq` and `ripgrep` for root verification scripts
- `lua5.1` for plugin `luac` syntax checks
- `neovim` for plugin verification inside `make verify`
- `python3` and `build-essential` for native Node dependencies such as `better-sqlite3`

## Logging

The runner logs:

- UTC timestamps for each high-level step
- runtime tool versions at startup
- the effective branch and workspace configuration
- commit/push decisions for each repo
- the failing command and line number if the run aborts

This keeps host-side `journalctl`, cron mail, or `docker logs` output readable without enabling shell tracing.

## Required Secrets And Settings

Required environment variables:

- `GITHUB_TOKEN`
- `GIT_AUTHOR_NAME`
- `GIT_AUTHOR_EMAIL`

Optional environment variables:

- `MONOREPO_URL` default: `https://github.com/raulcorreia7/theme-browser-monorepo.git`
- `MONOREPO_BRANCH` default: `master`
- `REGISTRY_BRANCH` default: `master`
- `PLUGIN_BRANCH` default: `main`
- `PNPM_STORE_DIR` default: `/var/lib/theme-browser-refresh/pnpm-store`
- `WORK_ROOT` default: `/var/lib/theme-browser-refresh`
- `SKIP_PUSH` default: `false`
- `SKIP_SUBMODULE_UPDATE` default: `false`

Recommended token scope:

- GitHub fine-grained token with `Contents: Read and write`
- access to:
  - `raulcorreia7/theme-browser-monorepo`
  - `raulcorreia7/theme-browser-registry`
  - `raulcorreia7/theme-browser.nvim`

## What The Runner Does

The runner:

1. clones the monorepo fresh
2. checks out the configured root, registry, and plugin branches
3. fast-forwards submodules
4. runs `pnpm install --frozen-lockfile`
5. runs `make pipeline`
6. runs `make verify`
7. commits and pushes:
   - registry repo if changed
   - plugin repo if changed
   - root repo if submodule pointers changed

Commit messages used by the runner:

- registry: `chore: refresh registry data`
- plugin: `chore: refresh bundled registry`
- root: `chore: refresh submodule pointers`

## Build The Image

From the monorepo root:

```bash
make docker-build
```

Or directly:

```bash
bash ./scripts/build-registry-dockerfile.sh
```

## Run It Manually

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

Recommended:

- `systemd timer` on the Docker host

Alternatives:

- host cron calling `docker run`
- Dokploy scheduled job if you already use Dokploy

Do not:

- run cron inside the container
- turn this into a permanently running service
- automate release tagging in the same job

## Failure Handling

Keep the first version simple:

- rely on container exit code
- review logs from `docker logs` or `journalctl`
- optionally add email or Discord/webhook notifications later

## Host Cron Example

See:

- [ops/cron/theme-browser-registry-refresh.cron](../ops/cron/theme-browser-registry-refresh.cron)

That example runs the job weekly at `03:00` every Sunday in the host timezone.

## Related Files

- image: [docker/registry.Dockerfile](../docker/registry.Dockerfile)
- runner: [registry-refresh.sh](../scripts/registry-refresh.sh)
- build helper: [build-registry-dockerfile.sh](../scripts/build-registry-dockerfile.sh)
- env sample: [ops/examples/registry-refresh.env.example](../ops/examples/registry-refresh.env.example)
- cron example: [ops/cron/theme-browser-registry-refresh.cron](../ops/cron/theme-browser-registry-refresh.cron)
- systemd service: [ops/systemd/theme-browser-registry-refresh.service](../ops/systemd/theme-browser-registry-refresh.service)
- systemd timer: [ops/systemd/theme-browser-registry-refresh.timer](../ops/systemd/theme-browser-registry-refresh.timer)
