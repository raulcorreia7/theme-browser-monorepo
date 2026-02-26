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

const LIGHT_PATTERNS = ["-light", "-day", "-latte", "-dawn", "-morning", "light-", "day-", "dawn-", "_light", "_day", "-snow", "-operandi", "-lumi"];
const DARK_PATTERNS = ["-dark", "-night", "-moon", "-storm", "-mocha", "-dragon", "-wave", "dark-", "night-", "_dark", "_night", "-dusk", "-vivendi", "-ember", "-fog", "-moss"];

function inferModeFromColorscheme(colorscheme) {
  if (!colorscheme || typeof colorscheme !== "string") return null;
  const name = colorscheme.toLowerCase();
  
  for (const pattern of LIGHT_PATTERNS) {
    if (name.includes(pattern)) return "light";
  }
  for (const pattern of DARK_PATTERNS) {
    if (name.includes(pattern)) return "dark";
  }
  return null;
}

function loadBuiltinThemes(overridesPath) {
  if (!existsSync(overridesPath)) {
    return { builtin: [], variantHints: new Map() };
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw);

  // Load variant mode hints from hints.json
  const variantHints = new Map();
  const hintsPath = resolve(dirname(overridesPath), "sources/hints.json");
  if (existsSync(hintsPath)) {
    try {
      const hintsRaw = readFileSync(hintsPath, "utf-8");
      const hintsData = JSON.parse(hintsRaw);
      if (Array.isArray(hintsData.hints)) {
        for (const hint of hintsData.hints) {
          if (hint.repo && hint.variantModes) {
            variantHints.set(hint.repo, hint.variantModes);
          }
        }
      }
    } catch (err) {
      logDim(`  Warning: Could not load variant hints: ${err.message}`);
    }
  }

  const builtin = Array.isArray(data.builtin)
    ? data.builtin.filter((t) => t && t.name && t.builtin === true)
    : [];

  return { builtin, variantHints };
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
  const { builtin: builtinThemes, variantHints } = loadBuiltinThemes(overrides);
  const builtinNames = new Set(builtinThemes.map((t) => t.name.toLowerCase()));

  // First pass: deduplicate by name, keeping the best theme
  const themesByName = new Map();
  const duplicates = [];
  let skippedInvalid = 0;

  for (const theme of themes) {
    if (!theme.name) continue;

    const nameLower = theme.name.toLowerCase();

    if (!isValidThemeName(theme.name)) {
      skippedInvalid++;
      continue;
    }

    const existing = themesByName.get(nameLower);
    if (existing) {
      // Compare: prefer Neovim themes, then higher stars, then more variants
      const isNeovimTheme = (repo) => repo && (repo.includes('.nvim') || repo.includes('neovim'));
      
      const existingIsNeovim = isNeovimTheme(existing.repo);
      const newIsNeovim = isNeovimTheme(theme.repo);
      const existingStars = existing.stars || 0;
      const existingVariants = existing.variants?.length || 0;
      const newStars = theme.stars || 0;
      const newVariants = theme.variants?.length || 0;
      
      let newIsBetter = false;
      let reason = '';
      
      if (newIsNeovim && !existingIsNeovim) {
        newIsBetter = true;
        reason = 'Neovim theme preferred';
      } else if (!newIsNeovim && existingIsNeovim) {
        newIsBetter = false;
        reason = 'Neovim theme preferred';
      } else if (newStars > existingStars) {
        newIsBetter = true;
        reason = `${newStars} > ${existingStars} stars`;
      } else if (newStars < existingStars) {
        newIsBetter = false;
        reason = `${existingStars} > ${newStars} stars`;
      } else if (newVariants > existingVariants) {
        newIsBetter = true;
        reason = `${newVariants} > ${existingVariants} variants`;
      } else {
        newIsBetter = false;
        reason = `${existingVariants} > ${newVariants} variants`;
      }
      
      if (newIsBetter) {
        duplicates.push({ 
          name: theme.name, 
          replaced: existing.repo, 
          with: theme.repo,
          reason: reason
        });
        themesByName.set(nameLower, theme);
      } else {
        duplicates.push({ 
          name: theme.name, 
          kept: existing.repo, 
          skipped: theme.repo,
          reason: reason
        });
      }
    } else {
      themesByName.set(nameLower, theme);
    }
  }

  const curated = [];

  for (const theme of themesByName.values()) {
    const nameLower = theme.name.toLowerCase();

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
      // Get variant mode hints for this repo
      const hintsForRepo = theme.repo ? variantHints.get(theme.repo) : null;

      entry.variants = theme.variants.map((v) => {
        const variant = {
          name: v.name,
          colorscheme: v.colorscheme,
        };

        if (v.mode) {
          variant.mode = v.mode;
        } else if (hintsForRepo && hintsForRepo[v.name]) {
          variant.mode = hintsForRepo[v.name];
        } else {
          const inferred = inferModeFromColorscheme(v.colorscheme);
          if (inferred) variant.mode = inferred;
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
    const nameLower = builtin.name.toLowerCase();
    if (themesByName.has(nameLower)) {
      continue;
    }

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
  if (skippedInvalid > 0) logDim(`  ${skippedInvalid} skipped (invalid names)`);
  if (duplicates.length > 0) {
    logDim(`  ${duplicates.length} duplicates resolved (kept highest stars/variants)`);
    for (const dup of duplicates.slice(0, 5)) {
      if (dup.kept) {
        logDim(`    ${dup.name}: kept ${dup.kept} (${dup.reason})`);
      } else {
        logDim(`    ${dup.name}: replaced ${dup.replaced} with ${dup.with} (${dup.reason})`);
      }
    }
    if (duplicates.length > 5) {
      logDim(`    ... and ${duplicates.length - 5} more`);
    }
  }

  writeFileSync(output, JSON.stringify(curated, null, 2) + "\n", "utf-8");

  logDone(`Generated ${curated.length} themes → ${output}`);
}

generate();
