# @theme-browser/registry (Rust)

> Rust theme registry indexer for [theme-browser.nvim](https://github.com/raulcorreia7/theme-browser.nvim).

High-performance rewrite of the TypeScript registry indexer. Discovers Neovim colorschemes from GitHub and produces a searchable `themes.json` index.

## Features

- Single binary distribution (no runtime dependencies)
- Async processing with Tokio
- SQLite caching
- Parallel topic discovery
- Concurrent batch processing
- Rate-limited GitHub API client

## Requirements

- Rust 1.70+
- GitHub token (for API access)

## Installation

```bash
cd theme-browser-registry-rs
cargo build --release
```

The binary will be at `target/release/theme-browser-registry`.

### GitHub Token

Create a fine-grained token with "Public repositories (read-only)" access:
https://github.com/settings/tokens?type=beta

```bash
cp .env.example .env
# Edit .env with your token
```

The token is loaded automatically from `.env` or can be passed via CLI:

```bash
# Uses .env automatically
./target/release/theme-browser-registry sync

# Or pass explicitly (for CI/CD)
./target/release/theme-browser-registry --token $GITHUB_TOKEN sync
```

## Commands

| Command | Description |
|---------|-------------|
| `sync` | Sync themes from GitHub |
| `watch` | Continuous sync |
| `publish` | Sync and push to git |
| `export` | Export database to JSON |

```bash
./target/release/theme-browser-registry sync      # Sync once
./target/release/theme-browser-registry watch     # Continuous
./target/release/theme-browser-registry publish   # Sync + git push
./target/release/theme-browser-registry export    # Export DB
```

**Output:**
- `artifacts/themes.json` — Theme index
- `artifacts/manifest.json` — Run metadata (count, checksum, timestamp)
- `artifacts/db-export.json` — Database export (via `export`)

## Configuration

See [config.json](config.json) for all options.

```json
{
  "version": "2.0.0",
  "discovery": {
    "topics": ["neovim-colorscheme", "nvim-theme", "vim-colorscheme"],
    "includeRepos": [],
    "pagination": { "perPage": 100, "maxPagesPerTopic": 5 }
  },
  "github": {
    "rateLimit": { "delayMs": 250, "retryLimit": 3 }
  },
  "processing": {
    "batch": { "size": 50, "pauseMs": 0 },
    "concurrency": 10,
    "maxReposPerRun": 0
  },
  "filters": {
    "minStars": 0,
    "skipArchived": true,
    "skipDisabled": true,
    "staleAfterDays": 14
  },
  "output": {
    "themes": "artifacts/themes.json",
    "manifest": "artifacts/manifest.json",
    "cache": ".state/indexer.db"
  },
  "overrides": "overrides.json",
  "runtime": { "scanIntervalSeconds": 1800, "logLevel": "INFO" },
  "sort": { "by": "stars", "order": "desc" },
  "publish": { "enabled": false }
}
```

## Testing

```bash
cargo test
```

## Architecture

```
src/
├── main.rs          # CLI entry point
├── lib.rs           # Library exports
├── cli.rs           # CLI argument parsing
├── config.rs        # Configuration loading (nested structure)
├── types.rs         # Core types (ThemeEntry, RepoCacheEntry, etc.)
├── github/
│   ├── mod.rs
│   ├── client.rs    # GitHub API client (octorust)
│   └── parser.rs    # Theme metadata extraction
├── db/
│   ├── mod.rs
│   └── cache.rs     # SQLite cache operations
├── commands/
│   ├── mod.rs
│   ├── sync.rs
│   ├── watch.rs
│   ├── publish.rs
│   └── export.rs
├── runner.rs        # Main orchestration (parallel discovery)
├── merge.rs         # Override merging
└── logger.rs        # Logging (tracing)
```

Data flow:
1. Discover repos via GitHub topics (parallel)
2. Fetch metadata and parse themes (concurrent batches)
3. Store in SQLite (incremental)
4. Write `themes.json` after each batch
5. Optionally publish to git

## Related

- [theme-browser.nvim](https://github.com/raulcorreia7/theme-browser.nvim) — Neovim theme gallery plugin
- [theme-browser-registry-ts](../theme-browser-registry-ts) — Original TypeScript implementation

## License

MIT
