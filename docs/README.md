# Documentation Index

Use this index to find the smallest doc that answers the question at hand.

This folder is for guides, runbooks, and operator-facing references.
Specifications, ADRs, and other design contracts are out of scope here and
should be escalated instead of folded into product docs.

## Start Here

| Doc | Use it when | Freshness trigger |
|-----|-------------|-------------------|
| [../README.md](../README.md) | You need the root workflow entry points | Root commands or repo layout change |
| [../packages/registry/README.md](../packages/registry/README.md) | You are working inside the registry package | Registry commands or outputs change |
| [../packages/plugin/README.md](../packages/plugin/README.md) | You need plugin install, usage, or config basics | Plugin UX or config changes |

## Runbooks

| Doc | Use it when | Freshness trigger |
|-----|-------------|-------------------|
| [release.md](./release.md) | You are preparing or verifying a coordinated release | Release script or version policy changes |
| [automation.md](./automation.md) | You are operating the scheduled refresh runner | Runner image, env vars, or deployment flow changes |
| [theme-detection.md](./theme-detection.md) | You are debugging a registry pipeline stage | Pipeline stage names, files, or commands change |

## Reference

| Doc | Use it when | Freshness trigger |
|-----|-------------|-------------------|
| [workflows.md](./workflows.md) | You need the high-level refresh vs release model | Workflow ownership or boundaries change |
| [theme-detection-heuristics.md](./theme-detection-heuristics.md) | You need scoring, tie-breaks, or manual hint rules | Detection heuristics change |

## Maintenance Cadence

- Update the touched guide in the same change whenever commands, outputs, or
  operator steps change.
- Review `release.md` before every tagged release.
- Review `automation.md`, `theme-detection.md`, and `packages/registry/README.md`
  after pipeline or runner changes.
- Do a quick doc link and freshness sweep once per month to remove stale or
  duplicate guidance.
