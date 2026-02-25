#!/usr/bin/env node
/**
 * 05-install-themes.mjs - Copy top themes to plugin for offline use
 *
 * Filters the top N themes by stars with mode coverage heuristics:
 * - Ensures mix of dark/light themes
 * - Prioritizes popular themes (by stars)
 * - Limits to 50 themes for plugin bundle size
 *
 * Usage: node scripts/05-install-themes.mjs [options]
 *
 * Options:
 *   -i, --input <path>    Input themes.json (default: theme-browser-registry-ts/artifacts/themes.json)
 *   -o, --output <path>   Output registry.json (default: theme-browser.nvim/lua/theme-browser/data/registry.json)
 *   -n, --count <n>       Number of themes to include (default: 50)
 *   -h, --help            Show help
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
05-install-themes - Copy top themes to plugin for offline use

Usage:
  05-install-themes [options]

Options:
  -i, --input <path>    Input themes.json (default: theme-browser-registry-ts/artifacts/themes.json)
  -o, --output <path>   Output registry.json (default: theme-browser.nvim/lua/theme-browser/data/registry.json)
  -n, --count <n>       Number of themes to include (default: 50)
  -h, --help            Show this help

Mode Heuristics:
  - Prioritizes themes with both dark and light variants
  - Ensures at least 40% dark and 20% light mode coverage
  - Falls back to popularity (stars) if mode constraints can't be met
`;

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i", default: "theme-browser-registry-ts/artifacts/themes.json" },
      output: { type: "string", short: "o", default: "theme-browser.nvim/lua/theme-browser/data/registry.json" },
      count: { type: "string", short: "n", default: "50" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  const count = parseInt(values.count, 10);
  if (isNaN(count) || count < 1 || count > 200) {
    console.error("Error: --count must be between 1 and 200");
    process.exit(1);
  }

  return {
    input: resolve(ROOT, values.input),
    output: resolve(ROOT, values.output),
    count,
  };
}

function getThemeModes(theme) {
  const modes = new Set();
  
  if (theme.mode) {
    modes.add(theme.mode);
  }
  
  if (theme.variants) {
    for (const variant of theme.variants) {
      if (variant.mode) {
        modes.add(variant.mode);
      }
    }
  }
  
  return modes;
}

function hasMode(theme, mode) {
  const modes = getThemeModes(theme);
  return modes.has(mode);
}

function scoreTheme(theme) {
  let score = theme.stars || 0;
  const modes = getThemeModes(theme);
  
  // Boost themes with both dark and light modes
  if (modes.has("dark") && modes.has("light")) {
    score *= 1.5;
  } else if (modes.has("dark")) {
    score *= 1.2;
  }
  
  // Slight boost for themes with variants (more options for users)
  if (theme.variants && theme.variants.length > 0) {
    score *= 1.1;
  }
  
  return score;
}

function selectThemesWithHeuristics(themes, targetCount) {
  // Group themes by name and keep the one with highest stars
  const themesByName = new Map();
  const duplicates = [];
  
  for (const theme of themes) {
    const existing = themesByName.get(theme.name);
    if (existing) {
      duplicates.push({ name: theme.name, kept: existing.repo, skipped: theme.repo, keptStars: existing.stars || 0, skippedStars: theme.stars || 0 });
      if ((theme.stars || 0) > (existing.stars || 0)) {
        themesByName.set(theme.name, theme);
      }
    } else {
      themesByName.set(theme.name, theme);
    }
  }
  
  if (duplicates.length > 0) {
    logDim(`  Resolved ${duplicates.length} duplicate theme names (kept highest stars)`);
    for (const dup of duplicates.slice(0, 5)) {
      logDim(`    ${dup.name}: kept ${dup.kept} (${dup.keptStars}⭐) over ${dup.skipped} (${dup.skippedStars}⭐)`);
    }
    if (duplicates.length > 5) {
      logDim(`    ... and ${duplicates.length - 5} more`);
    }
  }
  
  // Score all unique themes
  const scoredThemes = Array.from(themesByName.values()).map(theme => ({
    theme,
    score: scoreTheme(theme),
    modes: getThemeModes(theme),
  }));
  
  // Sort by score descending
  scoredThemes.sort((a, b) => b.score - a.score);
  
  const selected = [];
  const selectedNames = new Set();
  let darkCount = 0;
  let lightCount = 0;
  
  const minDark = Math.floor(targetCount * 0.4);  // At least 40% dark
  const minLight = Math.floor(targetCount * 0.2); // At least 20% light
  
  // First pass: ensure mode coverage
  for (const { theme, modes } of scoredThemes) {
    if (selected.length >= targetCount) break;
    if (selectedNames.has(theme.name)) continue;
    
    const hasDark = modes.has("dark");
    const hasLight = modes.has("light");
    
    // Prioritize themes that help meet mode quotas
    const needsDark = darkCount < minDark && hasDark;
    const needsLight = lightCount < minLight && hasLight;
    
    if (needsDark || needsLight || selected.length < targetCount - Math.max(0, minDark - darkCount) - Math.max(0, minLight - lightCount)) {
      selected.push(theme);
      selectedNames.add(theme.name);
      if (hasDark) darkCount++;
      if (hasLight) lightCount++;
    }
  }
  
  // Fill remaining slots with highest scored themes
  for (const { theme } of scoredThemes) {
    if (selected.length >= targetCount) break;
    if (selectedNames.has(theme.name)) continue;
    
    selected.push(theme);
    selectedNames.add(theme.name);
    if (getThemeModes(theme).has("dark")) darkCount++;
    if (getThemeModes(theme).has("light")) lightCount++;
  }
  
  // Sort final list alphabetically for consistent output
  selected.sort((a, b) => a.name.localeCompare(b.name));
  
  return { selected, darkCount, lightCount, duplicates: duplicates.length };
}

function install() {
  const { input, output, count } = parseCliArgs();

  if (!existsSync(input)) {
    console.error(`Error: Input file not found: ${input}`);
    console.error("Run 'make build' first to generate themes.json");
    process.exit(1);
  }

  log(`Reading ${input}`);
  
  const raw = readFileSync(input, "utf-8");
  const allThemes = JSON.parse(raw);
  
  logDim(`  Total themes available: ${allThemes.length}`);
  
  // Filter to valid themes only (must have name, repo, colorscheme)
  const validThemes = allThemes.filter(t => 
    t.name && t.repo && t.colorscheme
  );
  
  logDim(`  Valid themes: ${validThemes.length}`);
  
  // Select themes with heuristics
  const { selected, darkCount, lightCount, duplicates } = selectThemesWithHeuristics(validThemes, count);
  
  // Calculate stats
  const withVariants = selected.filter(t => t.variants && t.variants.length > 0).length;
  const builtinCount = selected.filter(t => t.builtin).length;
  const totalStars = selected.reduce((sum, t) => sum + (t.stars || 0), 0);
  const avgStars = Math.round(totalStars / selected.length);
  
  logDim(`  Selected: ${selected.length} themes`);
  logDim(`  Dark mode: ${darkCount}, Light mode: ${lightCount}`);
  logDim(`  With variants: ${withVariants}`);
  logDim(`  Builtin: ${builtinCount}`);
  logDim(`  Duplicates resolved: ${duplicates}`);
  logDim(`  Avg stars: ${avgStars.toLocaleString()}`);
  
  // Write to plugin
  writeFileSync(output, JSON.stringify(selected, null, 2) + "\n", "utf-8");
  
  logDone(`Installed ${selected.length} themes → ${output}`);
}

install();
