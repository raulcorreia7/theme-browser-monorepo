#!/usr/bin/env node
/**
 * 04-generate-themes.mjs - Generate final themes.json for plugin
 *
 * Usage: node scripts/04-generate-themes.mjs [options]
 *
 * Options:
 *   -i, --index <path>      Index file (default: theme-browser-registry-ts/artifacts/index.json)
 *   -o, --overrides <path>  Overrides file (default: theme-browser-registry-ts/overrides.json)
 *   -O, --output <path>     Output file (default: theme-browser-registry-ts/artifacts/themes.json)
 *   -h, --help              Show help
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

function log(msg) {
  console.log(`${COLORS.blue}→${COLORS.reset} ${msg}`);
}

function logDim(msg) {
  console.log(`${COLORS.dim}${msg}${COLORS.reset}`);
}

function logWarn(msg) {
  console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`);
}

function logDone(msg) {
  console.log("");
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
  console.log("");
}

const help = `
04-generate-themes - Generate final themes.json for plugin

Usage:
  04-generate-themes [options]

Options:
  -i, --index <path>      Index file (default: theme-browser-registry-ts/artifacts/index.json)
  -o, --overrides <path>  Overrides file (default: theme-browser-registry-ts/overrides.json)
  -O, --output <path>     Output file (default: theme-browser-registry-ts/artifacts/themes.json)
  -h, --help              Show this help
`;

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      index: { type: "string", short: "i", default: "theme-browser-registry-ts/artifacts/index.json" },
      overrides: { type: "string", short: "o", default: "theme-browser-registry-ts/overrides.json" },
      output: { type: "string", short: "O", default: "theme-browser-registry-ts/artifacts/themes.json" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  return {
    index: resolve(ROOT, values.index),
    overrides: resolve(ROOT, values.overrides),
    output: resolve(ROOT, values.output),
  };
}

function isValidThemeName(name) {
  if (!name || typeof name !== "string") return false;
  if (name.startsWith(".")) return false;
  if (name.length < 2) return false;
  if (name.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function loadBuiltinThemes(overridesPath) {
  if (!existsSync(overridesPath)) {
    return [];
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.builtin)) {
    return [];
  }

  return data.builtin.filter((t) => t && t.name && t.builtin === true);
}

function loadOverrides(overridesPath) {
  if (!existsSync(overridesPath)) {
    return new Map();
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.overrides)) {
    return new Map();
  }

  return new Map(data.overrides.map((o) => [o.repo, o]));
}

function generate() {
  const { index, overrides, output } = parseCliArgs();

  log(`Reading ${index}`);

  const raw = readFileSync(index, "utf-8");
  const themes = JSON.parse(raw);

  const overridesMap = loadOverrides(overrides);
  const builtinThemes = loadBuiltinThemes(overrides);
  const builtinNames = new Set(builtinThemes.map((t) => t.name.toLowerCase()));

  const seen = new Set();
  const curated = [];
  let skipped = { invalid: 0, duplicate: 0 };

  for (const theme of themes) {
    if (!theme.name) continue;

    const nameLower = theme.name.toLowerCase();

    if (!isValidThemeName(theme.name)) {
      skipped.invalid++;
      continue;
    }

    if (seen.has(nameLower)) {
      skipped.duplicate++;
      continue;
    }
    seen.add(nameLower);

    const override = theme.repo ? overridesMap.get(theme.repo) : null;

    const entry = {
      name: theme.name,
      repo: theme.repo,
      colorscheme: theme.colorscheme,
    };

    if (theme.stars) {
      entry.stars = theme.stars;
    }

    if (theme.mode) {
      entry.mode = theme.mode;
    }

    const strategy = override?.meta?.strategy ?? theme.meta?.strategy;
    entry.meta = { source: "github" };
    if (strategy) {
      entry.meta.strategy = strategy;
    }

    if (builtinNames.has(nameLower)) {
      entry.meta.conflicts = [nameLower];
    }

    if (theme.variants && theme.variants.length > 0) {
      entry.variants = theme.variants.map((v) => {
        const variant = {
          name: v.name,
          colorscheme: v.colorscheme,
        };

        if (v.mode) {
          variant.mode = v.mode;
        }

        if (v.meta && v.meta.strategy) {
          variant.meta = { strategy: v.meta.strategy };
        }

        return variant;
      });
    }

    curated.push(entry);
  }

  for (const builtin of builtinThemes) {
    const entry = {
      name: builtin.name,
      colorscheme: builtin.colorscheme,
      builtin: true,
      stars: 0,
    };

    if (builtin.description) {
      entry.description = builtin.description;
    }

    if (builtin.mode) {
      entry.mode = builtin.mode;
    }

    entry.meta = { source: "neovim" };
    if (builtin.meta && builtin.meta.strategy) {
      entry.meta.strategy = builtin.meta.strategy;
    }

    curated.push(entry);
  }

  logDim(`  ${builtinThemes.length} builtin themes`);
  if (skipped.invalid > 0) logDim(`  ${skipped.invalid} skipped (invalid names)`);
  if (skipped.duplicate > 0) logDim(`  ${skipped.duplicate} skipped (duplicates)`);

  writeFileSync(output, JSON.stringify(curated, null, 2) + "\n", "utf-8");

  logDone(`Generated ${curated.length} themes → ${output}`);
}

generate();
