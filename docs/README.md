# Documentation Map

Use the smallest doc that answers the question.

This folder is for guides, runbooks, and operator-facing references.
Specifications, ADRs, and contracts should be escalated instead of expanded
inside product docs.

## Core Docs

| Doc | Audience | Use it when | Freshness trigger |
|-----|----------|-------------|-------------------|
| `../README.md` | Workspace operator | You need the root commands or repo layout | Root workflows or package boundaries change |
| `../packages/registry/README.md` | Registry maintainer | You need registry setup, outputs, or package-local commands | Registry scripts, outputs, or env requirements change |
| `../packages/plugin/README.md` | Plugin user or maintainer | You need install, command, or config entry points | Plugin UX, commands, or defaults change |

## Runbooks

| Doc | Audience | Use it when | Freshness trigger |
|-----|----------|-------------|-------------------|
| `release.md` | Release owner | You are preparing or verifying a coordinated release | Release script, changelog policy, or version rules change |
| `automation.md` | Ops owner | You are running the scheduled refresh job | Runner scripts, image helpers, env vars, or commit flow changes |
| `theme-detection.md` | Registry maintainer | You are debugging a specific pipeline stage | Stage scripts, output paths, or debug commands change |

## Review Priority

Review these first when time is limited.

| Priority | Doc | Why it comes first | Owner | Review by |
|----------|-----|--------------------|-------|-----------|
| P0 | `../README.md` | Root entry point for setup, make targets, and doc discovery | Workspace maintainer | Same change as root workflow updates |
| P0 | `../packages/plugin/README.md` | Main user-facing install, command, and persistence guide | Plugin maintainer | Same change as plugin UX or default changes |
| P0 | `../packages/registry/README.md` | Operator entry point for registry setup, outputs, and commands | Registry maintainer | Same change as pipeline or output changes |
| P1 | `release.md` | Release mistakes are costly and block coordinated cuts | Release owner | Before every release |
| P1 | `automation.md` | Scheduled refresh drift can break unattended jobs | Ops owner | Same change as runner, image, or env changes |
| P2 | `workflows.md` | Explains ownership boundaries between refresh and release | Workspace maintainer | Same change as workflow boundaries |
| P2 | `theme-detection.md` | Debug reference for stage-level registry work | Registry maintainer | Same change as stage scripts or output paths |
| P3 | `theme-detection-heuristics.md` | Useful when debugging strategy picks, but not a first-stop guide | Registry maintainer | Same change as scoring, tie-breaks, or hints |

## Reference

| Doc | Audience | Use it when | Freshness trigger |
|-----|----------|-------------|-------------------|
| `workflows.md` | Maintainer | You need the refresh vs release boundary | Workflow ownership or outputs change |
| `theme-detection-heuristics.md` | Registry maintainer | You need scoring, tie-breaks, or hint rules | Detection scoring or manual hint rules change |
| `../packages/plugin/docs/configuration.md` | Plugin user | You need the authoritative plugin config reference | Plugin defaults, option names, or keymaps change |

## Escalate Instead

These are not product-knowledge docs and should be reviewed as design or
contract material when they drift:

- `../packages/plugin/docs/architecture.md`
- specifications, ADRs, schema contracts, and other design records

## Drift Watchlist

Review docs in the same change whenever you touch any of these:

- root `make` targets or root workflow scripts
- registry output paths, stage flags, or `.env` requirements
- plugin commands, defaults, keymaps, or persistence behavior
- release checks, version propagation, or tag policy

## Maintenance Cadence

- Same change: update the touched guide when operator steps or outputs change.
- Weekly ops sweep: review `automation.md` and the files it links before the
  scheduled refresh job changes owner, host path, env, or image behavior.
- Before every release: review `release.md`, the root `README.md`, and both
  package READMEs.
- Monthly: do a short link and redundancy sweep to remove stale content and
  collapse duplicate guidance back into `docs/README.md`.
