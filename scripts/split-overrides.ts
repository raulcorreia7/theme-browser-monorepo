#!/usr/bin/env node
/**
 * Split overrides.json into strategy-specific files
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

type ThemeEntry = {
  name: string;
  repo?: string;
  colorscheme?: string;
  variants?: Array<{ name: string; colorscheme?: string; mode?: string }>;
  meta?: { strategy?: { type?: StrategyType; module?: string; file?: string } };
};

type OverridesFile = {
  overrides: ThemeEntry[];
  builtin?: ThemeEntry[];
};

const OVERRIDES_DIR = "theme-browser-registry-ts/overrides";

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function splitOverrides(): void {
  const overrides = readJson<OverridesFile>("theme-browser-registry-ts/overrides.json");

  // Group by strategy
  const byStrategy: Record<StrategyType, ThemeEntry[]> = {
    setup: [],
    load: [],
    colorscheme: [],
    file: [],
    unknown: [],
  };

  for (const entry of overrides.overrides) {
    const strategy = entry.meta?.strategy?.type || "unknown";
    byStrategy[strategy].push(entry);
  }

  // Sort each group by name
  for (const strategy of Object.keys(byStrategy) as StrategyType[]) {
    byStrategy[strategy].sort((a, b) =>
      (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
    );
  }

  // Ensure directory exists
  mkdirSync(OVERRIDES_DIR, { recursive: true });

  // Write each strategy file
  for (const [strategy, themes] of Object.entries(byStrategy)) {
    if (themes.length === 0) continue;

    const filePath = path.join(OVERRIDES_DIR, `${strategy}.json`);
    writeJson(filePath, {
      $schema: "../schemas/strategy.schema.json",
      strategy,
      count: themes.length,
      themes,
    });
    console.log(`${strategy}: ${themes.length} themes → ${filePath}`);
  }

  // Write hints file (for manual overrides)
  const hintsPath = path.join(OVERRIDES_DIR, "hints.json");
  if (!existsSync(hintsPath)) {
    writeJson(hintsPath, {
      $schema: "../schemas/hints.schema.json",
      description: "Manual strategy hints for edge cases",
      hints: [
        {
          repo: "rktjmp/lush.nvim",
          strategy: "setup",
          reason: "Theme generator framework, not a theme itself",
        },
      ],
    });
    console.log(`Created hints file: ${hintsPath}`);
  }

  // Write builtin separately
  if (overrides.builtin && overrides.builtin.length > 0) {
    const builtinPath = path.join(OVERRIDES_DIR, "builtin.json");
    writeJson(builtinPath, {
      $schema: "../schemas/strategy.schema.json",
      strategy: "builtin",
      count: overrides.builtin.length,
      themes: overrides.builtin,
    });
    console.log(`builtin: ${overrides.builtin.length} themes → ${builtinPath}`);
  }
}

splitOverrides();
