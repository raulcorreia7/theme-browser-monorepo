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

- call `tb release`
- create tags
- publish GitHub releases

## Recommended Deployment

Run one small Debian VM or LXC host with a checked-out workspace at
`/opt/theme-browser-monorepo`, the `tb` binary built into `bin/tb`, and a
`systemd` timer invoking `tb refresh --unattended`.

That keeps scheduling simple and avoids maintaining a container image before
the deployment shape settles.

## Runtime Requirements

Host packages:

- `git`
- Go 1.22+ (to run `make build`)
- `neovim` (for plugin verification)

These cover git operations, workspace verification, and plugin checks.

## Required Environment

Parsed by `tb refresh --unattended` from the systemd `EnvironmentFile`.

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
| `WORK_ROOT` | no | `/var/lib/theme-browser-refresh` | Job working directory |
| `SKIP_PUSH` | no | `false` | Set to `true` to keep commits local for dry operational testing |
| `SKIP_SUBMODULE_UPDATE` | no | `false` | Set to `true` to skip the submodule fast-forward step |

Recommended GitHub token scope: fine-grained `Contents: Read and write` access to
the monorepo, registry repo, and plugin repo.

## What The Runner Does

`tb refresh --unattended`:

1. clones the monorepo with submodules into a temporary run directory under
   `WORK_ROOT`
2. checks out the configured root, registry, and plugin branches
3. fast-forwards submodules unless skipped
4. runs the refresh pipeline (registry artifacts plus bundled plugin registry)
5. runs workspace verification
6. commits and pushes changed repos in this order:
   - `packages/registry` with `chore: refresh registry data`
   - `packages/plugin` with `chore: refresh bundled registry`
   - root repo with `chore: refresh submodule pointers`

Temporary run directories are removed after each job.

## Run It Manually

Assume the workspace is checked out at `/opt/theme-browser-monorepo`.

```bash
git clone --recurse-submodules https://github.com/raulcorreia7/theme-browser-monorepo.git /opt/theme-browser-monorepo
cd /opt/theme-browser-monorepo
make build
GITHUB_TOKEN=... \
GIT_AUTHOR_NAME="theme-browser bot" \
GIT_AUTHOR_EMAIL="bot@example.com" \
./bin/tb refresh --unattended
```

Dry run (prints the plan without cloning, committing, or pushing):

```bash
./bin/tb refresh --dry-run
```

## Scheduling

Preferred: `systemd` timer on the host.

Install the units from `ops/systemd/`:

- `theme-browser-registry-refresh.service` runs
  `/opt/theme-browser-monorepo/bin/tb refresh --unattended` with
  `EnvironmentFile=/etc/theme-browser/registry-refresh.env`
- `theme-browser-registry-refresh.timer` fires weekly on Sunday at 03:00 with
  `Persistent=true`

Avoid converting this into a long-running service. Keep it as a short-lived
scheduled job.

## Failure Handling

Keep the first deployment simple:

- rely on the exit code (`Type=oneshot`)
- inspect `journalctl --unit theme-browser-registry-refresh.service`
- add notifications later if the job proves stable and useful

## Related Files

- `../README.md` - root entry point for operators
- `README.md` - documentation map and review priority
- `workflows.md` - refresh vs release boundaries
- `../ops/examples/registry-refresh.env.example` - sample environment file
- `../ops/systemd/theme-browser-registry-refresh.service` - service unit
- `../ops/systemd/theme-browser-registry-refresh.timer` - timer unit
