#!/usr/bin/env node
/**
 * generate-registry.mjs - Generate bundled registry.json from themes.json
 * 
 * Usage: node scripts/build/generate-registry.mjs
 * 
 * Reads from theme-browser-registry-ts/artifacts/themes.json (produced by registry-ts indexer)
 * and builtin themes from overrides.json, outputs to theme-browser.nvim/lua/theme-browser/data/registry.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const THEMES_PATH = resolve(ROOT, 'theme-browser-registry-ts/artifacts/themes.json');
const OVERRIDES_PATH = resolve(ROOT, 'theme-browser-registry-ts/overrides.json');
const OUTPUT_PATH = resolve(ROOT, 'theme-browser.nvim/lua/theme-browser/data/registry.json');

function loadBuiltinThemes() {
  if (!existsSync(OVERRIDES_PATH)) {
    return [];
  }
  
  const raw = readFileSync(OVERRIDES_PATH, 'utf-8');
  const data = JSON.parse(raw);
  
  if (!Array.isArray(data.builtin)) {
    return [];
  }
  
  return data.builtin.filter(t => t && t.name && t.builtin === true);
}

function generate() {
  console.log('Reading from themes.json:', THEMES_PATH);
  
  const raw = readFileSync(THEMES_PATH, 'utf-8');
  const themes = JSON.parse(raw);
  
  // Include ALL themes (with and without variants)
  const curated = themes
    .filter(t => t.name) // ensure has name
    .map(theme => {
      const entry = {
        name: theme.name,
        repo: theme.repo,
        colorscheme: theme.colorscheme,
      };
      
      // Add mode to theme if present
      if (theme.mode) {
        entry.mode = theme.mode;
      }
      
      // Add strategy to theme if present
      if (theme.meta && theme.meta.strategy) {
        entry.meta = { strategy: theme.meta.strategy };
      }
      
      // Add variants with mode
      if (theme.variants && theme.variants.length > 0) {
        entry.variants = theme.variants.map(v => {
          const variant = {
            name: v.name,
            colorscheme: v.colorscheme,
          };
          
          // Add mode if present
          if (v.mode) {
            variant.mode = v.mode;
          }
          
          // Add strategy if present in variant
          if (v.meta && v.meta.strategy) {
            variant.meta = { strategy: v.meta.strategy };
          }
          
          return variant;
        });
      }
      
      return entry;
    });
  
  // Load and add builtin themes
  const builtinThemes = loadBuiltinThemes();
  console.log('Found', builtinThemes.length, 'builtin themes');
  
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
  console.log('Writing to:', OUTPUT_PATH);
  
  writeFileSync(OUTPUT_PATH, JSON.stringify(curated, null, 2) + '\n', 'utf-8');
  
  console.log('Done!');
}

generate();
