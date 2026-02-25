#!/usr/bin/env node
/**
 * Build overrides.json from source files
 *
 * Merges sources/*.json → overrides.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

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

const SOURCES_DIR = "theme-browser-registry-ts/sources";
const OUTPUT_FILE = "theme-browser-registry-ts/overrides.json";

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function buildOverrides(): void {
  const allThemes: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  const files = readdirSync(SOURCES_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    if (file === "hints.json") continue;

    const filePath = path.join(SOURCES_DIR, file);
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

  const hints = readJson<HintsFile>(path.join(SOURCES_DIR, "hints.json"));
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

  writeJson(OUTPUT_FILE, merged);

  console.log(`Built ${allThemes.length} themes + ${builtin.length} builtin`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

buildOverrides();
