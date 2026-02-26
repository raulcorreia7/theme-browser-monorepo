#!/usr/bin/env node
/**
 * 01-sync-index.ts - Sync themes from GitHub to index.json
 *
 * Usage: npx tsx scripts/01-sync-index.ts [options]
 *
 * Options:
 *   -c, --config <path>   Config file (default: theme-browser-registry-ts/config.json)
 *   -v, --verbose         Enable verbose logging
 *   -h, --help            Show help
 */
import { parseArgs } from "node:util";
import { resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");

const help = `
01-sync-index - Sync themes from GitHub to index.json

Usage:
  01-sync-index [options]

Options:
  -c, --config <path>   Config file (default: theme-browser-registry-ts/config.json)
  -v, --verbose         Enable verbose logging
  -h, --help            Show this help
`;

const {
  values: { config, verbose, help: showHelp },
} = parseArgs({
  options: {
    config: { type: "string", short: "c", default: "theme-browser-registry-ts/config.json" },
    verbose: { type: "boolean", short: "v", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

if (showHelp) {
  console.log(help);
  process.exit(0);
}

const configPath = resolve(ROOT, config);
const args = ["run", "sync", "-w", "theme-browser-registry-ts", "--", "-c", configPath];
if (verbose) args.push("-v");

const result = spawnSync("npm", args, { cwd: ROOT, stdio: "inherit" });
process.exit(result.status ?? 1);
