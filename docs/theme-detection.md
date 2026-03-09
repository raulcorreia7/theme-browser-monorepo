# Theme Detection Stages

How to debug the registry detection and build stages without running the full monorepo pipeline.

The normal top-level flow stays:

```bash
make pipeline
make verify
```

Use the commands below only when you need to inspect a specific registry stage.

## Layout

Generated outputs:

```text
packages/registry/
├── artifacts/            # index.json, themes.json, manifest.json
├── reports/              # detect reports and coverage summaries
└── tasks/                # stage runners
```

Curated inputs:

```text
packages/registry/
└── config/
    ├── registry.json     # runtime configuration
    ├── overrides.json    # merged/editorial overrides used by build
    ├── excluded.json     # optional deny-list / editorial tracking
    └── sources/          # strategy and hint inputs
```

## Local Commands

Run these from `packages/registry`.

```bash
pnpm pipeline
pnpm pipeline:testing
pnpm sync
pnpm detect
pnpm merge
pnpm themes
pnpm bundle
pnpm top50
pnpm manifest
pnpm validate
```

## Pipeline Stages

| Stage | Implementation | Purpose | Key Options |
|-------|----------------|---------|-------------|
| sync | `tasks/01-sync.ts` | Sync from GitHub | `-c, --config`, `-v, --verbose` |
| detect | `tasks/02-detect.ts` | Detect strategies | `-i, --index`, `-s, --sources`, `-n, --sample`, `-r, --repo`, `--apply` |
| merge | `tasks/03-merge.ts` | Merge to `config/overrides.json` | `-s, --sources`, `-o, --output` |
| build | `tasks/04-build.ts` | Generate `themes.json` | `-i, --index`, `-o, --overrides`, `-O, --output` |
| bundle | `tasks/05-bundle.ts` | Bundle plugin registry | `-o, --output` |
| manifest | `tasks/06-manifest.ts` | Generate `manifest.json` | |
| top50 | `tasks/07-top-themes.ts` | Generate top 50 list | |
| validate | `tasks/validate/registry.ts` | Validate generated output | `-i, --input` |

## When To Use Which Command

- `pnpm pipeline` when you want the normal package-local end-to-end flow
- `pnpm pipeline:testing` when you want isolated outputs without mutating curated sources
- `pnpm detect` when you are reviewing strategy guesses
- `pnpm merge` when you want to inspect how curated sources become overrides
- `pnpm themes` when you only need to regenerate `artifacts/themes.json`
- `pnpm validate` when you want a report over an already-generated `themes.json`

## Curated Inputs

For repos that defy automatic detection, edit `config/sources/hints.json`:

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

Exclusions are enforced in two layers:

- `config/registry.json` → `discovery.excludeRepos`
- `config/excluded.json` → optional curated deny-list / editorial tracking

Count semantics:

- `themes` means top-level theme records
- `variants` means nested variant options under those themes

## Related Doc

For heuristic details, scoring, tie-breaking, and edge cases, see [theme-detection-heuristics.md](./theme-detection-heuristics.md).
