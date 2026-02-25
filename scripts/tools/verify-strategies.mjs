#!/usr/bin/env zx
/**
 * verify-strategies.mjs - Generate LLM verification instructions for theme strategies
 *
 * Usage: zx scripts/tools/verify-strategies.mjs
 *
 * Reads themes.json and outputs analysis prompts for each theme.
 * Uses gh CLI to fetch repository READMEs.
 *
 * This is a skeleton script for LLM agent verification.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const THEMES_PATH = resolve(ROOT, 'theme-browser-registry-ts/artifacts/themes.json');

if (!existsSync(THEMES_PATH)) {
  console.error('themes.json not found:', THEMES_PATH);
  process.exit(1);
}

const themes = JSON.parse(readFileSync(THEMES_PATH, 'utf-8'));

console.log('# Theme Strategy Verification Instructions\n');
console.log(`Total themes to verify: ${themes.length}\n`);
console.log('---\n');

for (const theme of themes) {
  const strategy = theme.meta?.strategy?.type || 
                   theme.variants?.[0]?.meta?.strategy?.type || 
                   'colorscheme';
  const variantCount = theme.variants?.length || 0;
  const modes = new Set();
  
  if (theme.variants) {
    theme.variants.forEach(v => v.mode && modes.add(v.mode));
  } else if (theme.mode) {
    modes.add(theme.mode);
  }

  console.log(`## ${theme.name}\n`);
  console.log(`- **Repo**: \`${theme.repo}\``);
  console.log(`- **Current Strategy**: \`${strategy}\``);
  console.log(`- **Variants**: ${variantCount}`);
  console.log(`- **Modes**: ${modes.size > 0 ? [...modes].join(', ') : 'unknown'}\n`);
  
  console.log('**Fetch README**:');
  console.log('```bash');
  console.log(`gh repo view ${theme.repo} --json readme --jq .readme`);
  console.log('```\n');
  
  console.log('**Verification Tasks**:');
  console.log('1. Check if loading strategy is correct (setup/load/colorscheme/file)');
  console.log('2. Verify variants and their modes (dark/light)');
  console.log('3. Update overrides.json if strategy needs correction');
  console.log('4. Create themes/${theme.name}.lua if file strategy is needed\n');
  console.log('---\n');
}

console.log('## Files to Update\n');
console.log('- `theme-browser-registry-ts/overrides.json`');
console.log('- `theme-browser-registry-ts/themes/*.lua`\n');

console.log('## Summary Template\n');
console.log('After verification, provide:');
console.log('- Number of themes verified');
console.log('- List of themes with strategy changes');
console.log('- List of new .lua files created');
