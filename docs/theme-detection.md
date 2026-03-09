# Theme Detection Stages

Use this guide when you need to debug one registry stage without running the
full monorepo workflow.

Normal top-level flow:

```bash
make refresh
make verify
```

## Run From

Run the commands in this guide from `packages/registry`.

## Outputs

Normal outputs:

| Path | Purpose |
|------|---------|
| `artifacts/index.json` | Synced raw theme index |
| `artifacts/themes.json` | Main generated registry |
| `artifacts/themes-top-50.json` | Ranked top-themes artifact |
| `artifacts/manifest.json` | Version, checksum, and generated-at metadata |
| `reports/detection.json` | Detect-stage decisions |
| `reports/variant-coverage.json` | Variant coverage summary |
| `../plugin/lua/theme-browser/data/registry.json` | Bundled plugin registry |

Testing mode redirects outputs to:

- `artifacts/testing/index.json`
- `artifacts/testing/themes.json`
- `artifacts/testing/themes-top-50.json`
- `artifacts/testing/manifest.json`
- `artifacts/testing/overrides.json`
- `artifacts/testing/registry.json`
- `reports/testing/`

## Main Commands

```bash
pnpm pipeline
pnpm pipeline:testing
pnpm sync
pnpm detect
pnpm detect:dry-run
pnpm merge
pnpm themes
pnpm top50
pnpm manifest
pnpm bundle
pnpm validate
```

## Pipeline Stages

| Stage | Script | Purpose | Key options |
|-------|--------|---------|-------------|
| sync | `tasks/01-sync.ts` | Sync from GitHub into `artifacts/index.json` | `-c, --config`, `-v, --verbose` |
| detect | `tasks/02-detect.ts` | Detect theme strategies | `-i, --index`, `-s, --sources`, `-n, --sample`, `-r, --repo`, `--apply` |
| merge | `tasks/03-merge.ts` | Merge curated sources into overrides | `-s, --sources`, `-o, --output` |
| build | `tasks/04-build.ts` | Generate `artifacts/themes.json` | `-c, --config`, `-i, --index`, `-o, --overrides`, `-O, --output`, `--minify` |
| top50 | `tasks/07-top-themes.ts` | Generate `artifacts/themes-top-50.json` | `-i, --input`, `-o, --output`, `-c, --count` |
| bundle | `tasks/05-bundle.ts` | Write bundled plugin `registry.json` | `-o, --output` |
| manifest | `tasks/06-manifest.ts` | Generate `artifacts/manifest.json` | `-i, --input`, `-o, --output` |
| validate | `tasks/validate/registry.ts` | Validate generated output | `-i, --input` |

## When To Use Which Command

- `pnpm pipeline` for the normal package-local end-to-end flow
- `pnpm pipeline:testing` for isolated outputs without mutating curated sources
- `pnpm detect:dry-run` when you want to inspect strategy guesses before patching
- `pnpm merge` when you want to inspect how curated sources become overrides
- `pnpm themes` when you only need to regenerate `themes.json`
- `pnpm validate` when you already have output and only want validation

## Curated Inputs

Main curated files:

| Path | Purpose |
|------|---------|
| `config/registry.json` | Runtime configuration |
| `config/overrides.json` | Generated editorial overrides |
| `config/excluded.json` | Optional deny-list and editorial tracking |
| `config/sources/hints.json` | Manual detection hints |

Example hint:

```json
{
  "description": "Manual strategy overrides",
  "hints": [
    {
      "repo": "rktjmp/lush.nvim",
      "strategy": "setup",
      "reason": "Theme generator framework, not a theme"
    }
  ]
}
```

Exclusions are enforced in two places:

- `config/registry.json` via `discovery.excludeRepos`
- `config/excluded.json` for optional editorial tracking

## Related Docs

- `theme-detection-heuristics.md` - scoring, tie-breaks, and manual hint rules
- `../packages/registry/README.md` - registry package overview and outputs
