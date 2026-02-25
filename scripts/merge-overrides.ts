#!/usr/bin/env node
/**
 * Merge strategy files into overrides.json
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

const OVERRIDES_DIR = "theme-browser-registry-ts/overrides";

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function mergeOverrides(): void {
  const allThemes: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  // Read all strategy files
  const files = readdirSync(OVERRIDES_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    if (file === "hints.json") continue;

    const filePath = path.join(OVERRIDES_DIR, file);
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

  // Apply hints
  const hints = readJson<HintsFile>(path.join(OVERRIDES_DIR, "hints.json"));
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

  // Sort by name
  allThemes.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
  );
  builtin.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
  );

  // Write merged overrides.json
  const merged = {
    overrides: allThemes,
    ...(builtin.length > 0 && { builtin }),
  };

  writeJson("theme-browser-registry-ts/overrides.json", merged);

  console.log(`Merged ${allThemes.length} themes + ${builtin.length} builtin`);
  console.log(`Written to theme-browser-registry-ts/overrides.json`);
}

mergeOverrides();
