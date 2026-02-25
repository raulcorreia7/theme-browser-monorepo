//! Override merging for theme entries.

use crate::types::ThemeEntry;
use std::collections::{HashMap, HashSet};

/// Partial theme entry for overrides.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct OverrideEntry {
    pub repo: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub colorscheme: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub stars: Option<u32>,
    #[serde(default)]
    pub topics: Option<Vec<String>>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub archived: Option<bool>,
    #[serde(default)]
    pub disabled: Option<bool>,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub meta: Option<crate::types::ThemeMeta>,
    #[serde(default)]
    pub variants: Option<Vec<crate::types::ThemeVariant>>,
    #[serde(default)]
    pub aliases: Option<Vec<String>>,
    #[serde(default)]
    pub deps: Option<Vec<String>>,
}

/// Result of loading overrides file.
#[derive(Debug, Clone, Default)]
pub struct LoadOverridesResult {
    pub overrides: Vec<OverrideEntry>,
    pub excluded: Vec<String>,
}

/// Loads overrides from a JSON file.
pub fn load_overrides(path: &std::path::Path) -> LoadOverridesResult {
    if !path.exists() {
        return LoadOverridesResult::default();
    }

    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return LoadOverridesResult::default(),
    };

    let raw: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return LoadOverridesResult::default(),
    };

    let obj = match raw.as_object() {
        Some(o) => o,
        None => return LoadOverridesResult::default(),
    };

    let mut overrides = Vec::new();
    if let Some(overrides_arr) = obj.get("overrides").and_then(|v| v.as_array()) {
        for item in overrides_arr {
            if let Ok(entry) = serde_json::from_value::<OverrideEntry>(item.clone()) {
                if !entry.repo.is_empty() {
                    overrides.push(entry);
                }
            }
        }
    }

    let mut excluded = Vec::new();
    if let Some(excluded_arr) = obj.get("excluded").and_then(|v| v.as_array()) {
        for item in excluded_arr {
            if let Some(s) = item.as_str() {
                if !s.is_empty() {
                    excluded.push(s.to_string());
                }
            }
        }
    }

    LoadOverridesResult {
        overrides,
        excluded,
    }
}

/// Applies overrides to theme entries.
pub fn apply_overrides(
    entries: Vec<ThemeEntry>,
    overrides: &[OverrideEntry],
    excluded: &[String],
) -> Vec<ThemeEntry> {
    let excluded_set: HashSet<&str> = excluded.iter().map(|s| s.as_str()).collect();

    let mut by_repo: HashMap<String, ThemeEntry> = entries
        .into_iter()
        .filter(|e| !excluded_set.contains(e.repo.as_str()))
        .map(|e| (e.repo.clone(), e))
        .collect();

    for override_entry in overrides {
        if override_entry.repo.is_empty() {
            continue;
        }

        let existing = by_repo.get(&override_entry.repo).cloned();

        let base = existing.unwrap_or_else(|| ThemeEntry {
            name: override_entry.name.clone().unwrap_or_default(),
            repo: override_entry.repo.clone(),
            colorscheme: override_entry.colorscheme.clone().unwrap_or_default(),
            description: override_entry.description.clone(),
            stars: override_entry.stars,
            topics: override_entry.topics.clone(),
            updated_at: override_entry.updated_at.clone(),
            archived: override_entry.archived,
            disabled: override_entry.disabled,
            homepage: override_entry.homepage.clone(),
            meta: override_entry.meta.clone(),
            variants: override_entry.variants.clone(),
            aliases: override_entry.aliases.clone(),
            deps: override_entry.deps.clone(),
        });

        by_repo.insert(
            override_entry.repo.clone(),
            merge_entry(base, override_entry),
        );
    }

    by_repo.into_values().collect()
}

fn merge_entry(mut base: ThemeEntry, override_entry: &OverrideEntry) -> ThemeEntry {
    if let Some(ref name) = override_entry.name {
        base.name = name.clone();
    }
    if let Some(ref colorscheme) = override_entry.colorscheme {
        base.colorscheme = colorscheme.clone();
    }
    if override_entry.description.is_some() {
        base.description = override_entry.description.clone();
    }
    if override_entry.stars.is_some() {
        base.stars = override_entry.stars;
    }
    if override_entry.topics.is_some() {
        base.topics = override_entry.topics.clone();
    }
    if override_entry.updated_at.is_some() {
        base.updated_at = override_entry.updated_at.clone();
    }
    if override_entry.archived.is_some() {
        base.archived = override_entry.archived;
    }
    if override_entry.disabled.is_some() {
        base.disabled = override_entry.disabled;
    }
    if override_entry.homepage.is_some() {
        base.homepage = override_entry.homepage.clone();
    }
    if override_entry.meta.is_some() {
        base.meta = override_entry.meta.clone();
    }
    if override_entry.variants.is_some() {
        base.variants = override_entry.variants.clone();
    }
    if override_entry.aliases.is_some() {
        base.aliases = override_entry.aliases.clone();
    }
    if override_entry.deps.is_some() {
        base.deps = override_entry.deps.clone();
    }

    base
}
