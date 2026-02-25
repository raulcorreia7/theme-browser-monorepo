#!/usr/bin/env tsx
/**
 * generate-bundle.ts - Generate bundled themes file for the plugin
 *
 * Generates a themes file with top themes by stars, applying all overrides.
 *
 * Usage: npx tsx scripts/generate-bundle.ts [options]
 *
 * Options:
 *   --min-stars <n>   Minimum stars threshold (default: 100)
 *   --limit <n>       Maximum themes to include (default: 50)
 *   --input <path>    Input themes.json path (default: theme-browser-registry-ts/artifacts/themes.json)
 *   --output <path>   Output file path (default: theme-browser.nvim/lua/theme-browser/data/themes-top-50.json)
 *   -h, --help        Show help
 */

import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const help = `
generate-bundle - Generate bundled themes file for the plugin

Usage:
  generate-bundle [options]

Options:
  --min-stars <n>   Minimum stars threshold (default: 100)
  --limit <n>       Maximum themes to include (default: 50)
  --input <path>    Input themes.json path
  --output <path>   Output file path
  -h, --help        Show this help
`;

interface ThemeVariant {
  name: string;
  colorscheme?: string;
  mode?: "dark" | "light";
  meta?: Record<string, unknown>;
}

interface ThemeEntry {
  name: string;
  repo?: string;
  colorscheme?: string;
  variants?: ThemeVariant[];
  stars?: number | null;
  description?: string;
  tags?: string[];
  homepage?: string;
  deprecated?: boolean;
  disabled?: boolean;
  meta?: {
    strategy?: {
      type: string;
      module?: string;
      file?: string;
    };
    background?: "dark" | "light";
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      "min-stars": { type: "string", default: "100" },
      limit: { type: "string", default: "50" },
      input: {
        type: "string",
        default: "theme-browser-registry-ts/artifacts/themes.json",
      },
      output: {
        type: "string",
        default: "theme-browser.nvim/lua/theme-browser/data/themes-top-50.json",
      },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  return {
    minStars: parseInt(values["min-stars"], 10),
    limit: parseInt(values.limit, 10),
    input: resolve(ROOT, values.input),
    output: resolve(ROOT, values.output),
  };
}

function main() {
  const opts = parseCliArgs();

  if (!existsSync(opts.input)) {
    console.error(`Input file not found: ${opts.input}`);
    console.error("Run 'npx tsx scripts/04-generate-themes.mjs' first");
    process.exit(1);
  }

  const themes: ThemeEntry[] = JSON.parse(readFileSync(opts.input, "utf-8"));

  console.log(`Loaded ${themes.length} themes from ${opts.input}`);

  // Filter by minimum stars (handle null stars as 0)
  const eligible = themes.filter((t) => {
    if (t.deprecated || t.disabled) return false;
    const stars = t.stars ?? 0;
    return stars >= opts.minStars;
  });

  console.log(`${eligible.length} themes with ${opts.minStars}+ stars`);

  // Sort by stars descending (null stars at end)
  const sorted = eligible.sort((a, b) => {
    const starsA = a.stars ?? 0;
    const starsB = b.stars ?? 0;
    return starsB - starsA;
  });

  // Take top N
  const topThemes = sorted.slice(0, opts.limit);

  console.log(`Selected top ${topThemes.length} themes`);

  // Stats
  const withVariants = topThemes.filter((t) => t.variants && t.variants.length > 0).length;
  const totalVariants = topThemes.reduce(
    (sum, t) => sum + (t.variants?.length ?? 0),
    0
  );
  const variantsWithMode = topThemes.reduce(
    (sum, t) => sum + (t.variants?.filter((v) => v.mode).length ?? 0),
    0
  );

  console.log(`Themes with variants: ${withVariants}`);
  console.log(`Total variants: ${totalVariants}`);
  console.log(`Variants with mode: ${variantsWithMode}`);

  // Ensure output directory exists
  const outputDir = dirname(opts.output);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  writeFileSync(opts.output, JSON.stringify(topThemes, null, 2));
  console.log(`\nWritten to: ${opts.output}`);

  // Print summary
  console.log("\nTop 10 themes:");
  for (let i = 0; i < Math.min(10, topThemes.length); i++) {
    const t = topThemes[i];
    const variants = t.variants?.length ?? 0;
    console.log(`  ${i + 1}. ${t.name} (${t.stars ?? 0} stars, ${variants} variants)`);
  }
}

main();
