#!/usr/bin/env node
/**
 * 04-generate-themes.mjs - Generate final themes.json for plugin
 *
 * Usage: node scripts/04-generate-themes.mjs [options]
 *
 * Options:
 *   -i, --index <path>    Index file (default: theme-browser-registry-ts/artifacts/index.json)
 *   -o, --overrides <path> Overrides file (default: theme-browser-registry-ts/overrides.json)
 *   -O, --output <path>   Output file (default: theme-browser-registry-ts/artifacts/themes.json)
 *   -h, --help            Show help
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

  console.log("Reading index:", index);
  const raw = readFileSync(index, "utf-8");
  const themes = JSON.parse(raw);

  const overridesMap = loadOverrides(overrides);

  const curated = themes
    .filter((t) => t.name)
    .map((theme) => {
      const override = theme.repo ? overridesMap.get(theme.repo) : null;

      const entry = {
        name: theme.name,
        repo: theme.repo,
        colorscheme: theme.colorscheme,
      };

      if (theme.mode) {
        entry.mode = theme.mode;
      }

      const strategy = override?.meta?.strategy ?? theme.meta?.strategy;
      if (strategy) {
        entry.meta = { strategy };
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

      return entry;
    });

  const builtinThemes = loadBuiltinThemes(overrides);
  console.log("Found", builtinThemes.length, "builtin themes");

  for (const builtin of builtinThemes) {
    const entry = {
      name: builtin.name,
      colorscheme: builtin.colorscheme,
      builtin: true,
    };

    if (builtin.description) {
      entry.description = builtin.description;
    }

    if (builtin.mode) {
      entry.mode = builtin.mode;
    }

    if (builtin.meta && builtin.meta.strategy) {
      entry.meta = { strategy: builtin.meta.strategy };
    }

    curated.push(entry);
  }

  console.log(`Generated ${curated.length} themes (${builtinThemes.length} builtin)`);
  console.log("Writing to:", output);

  writeFileSync(output, JSON.stringify(curated, null, 2) + "\n", "utf-8");

  console.log("Done!");
}

generate();
