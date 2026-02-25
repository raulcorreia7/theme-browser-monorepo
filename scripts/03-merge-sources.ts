#!/usr/bin/env node
/**
 * 03-merge-sources.ts - Merge source files into overrides.json
 *
 * Usage: npx tsx scripts/03-merge-sources.ts [options]
 *
 * Options:
 *   -s, --sources <dir>   Sources directory (default: theme-browser-registry-ts/sources)
 *   -o, --output <path>   Output file (default: theme-browser-registry-ts/overrides.json)
 *   -h, --help            Show help
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { resolve } from "node:path";
import { log, logDone } from "./lib/logger.js";

const ROOT = resolve(import.meta.dirname, "..");

const help = `
03-merge-sources - Merge source files into overrides.json

Usage:
  03-merge-sources [options]

Options:
  -s, --sources <dir>   Sources directory (default: theme-browser-registry-ts/sources)
  -o, --output <path>   Output file (default: theme-browser-registry-ts/overrides.json)
  -h, --help            Show this help
`;

type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

type ThemeEntry = {
  name: string;
  repo?: string;
  colorscheme?: string;
  variants?: Array<{ name: string; colorscheme?: string; mode?: string }>;
  meta?: { strategy?: { type?: StrategyType; module?: string; file?: string } };
};

type StrategyFile = {
  strategy: StrategyType;
  count: number;
  themes: ThemeEntry[];
};

type Hint = {
  repo: string;
  strategy: StrategyType;
  reason: string;
};

type HintsFile = {
  description: string;
  hints: Hint[];
};

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      sources: { type: "string", short: "s", default: "theme-browser-registry-ts/sources" },
      output: { type: "string", short: "o", default: "theme-browser-registry-ts/overrides.json" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  return {
    sources: resolve(ROOT, values.sources),
    output: resolve(ROOT, values.output),
  };
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function merge(): void {
  const { sources, output } = parseCliArgs();
  const allThemes: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  const files = readdirSync(sources).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    if (file === "hints.json") continue;

    const filePath = path.join(sources, file);
    const data = readJson<StrategyFile | { themes: ThemeEntry[] }>(filePath);
    if (!data) continue;

    if ("strategy" in data) {
      if (data.strategy === "builtin") {
        builtin.push(...data.themes);
      } else {
        allThemes.push(...data.themes);
      }
    }
  }

  const hints = readJson<HintsFile>(path.join(sources, "hints.json"));
  if (hints?.hints) {
    const hintMap = new Map(hints.hints.map((h) => [h.repo, h.strategy]));
    for (const theme of allThemes) {
      if (theme.repo && hintMap.has(theme.repo)) {
        if (!theme.meta) theme.meta = {};
        if (!theme.meta.strategy) theme.meta.strategy = { type: hintMap.get(theme.repo)! };
        else theme.meta.strategy.type = hintMap.get(theme.repo)!;
      }
    }
  }

  allThemes.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
  );
  builtin.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
  );

  const merged = {
    overrides: allThemes,
    ...(builtin.length > 0 && { builtin }),
  };

  writeJson(output, merged);

  logDone(`Merged ${allThemes.length} themes + ${builtin.length} builtin → ${output}`);
}

merge();
