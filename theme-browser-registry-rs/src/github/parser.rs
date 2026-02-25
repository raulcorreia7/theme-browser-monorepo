//! Theme metadata extraction from GitHub repository data.

use crate::types::{GitHubRepoItem, GitHubTreeItem, ThemeEntry, ThemeVariant};
use std::collections::HashSet;

const COLORS_FILE_PATTERN: &str = r"^colors/([^/]+)\.(vim|lua)$";

/// Suffixes to strip from repository names to get theme names.
const SUFFIXES_TO_STRIP: &[&str] = &[
    ".nvim",
    ".vim",
    ".lua",
    "-nvim",
    "_nvim",
    "-vim",
    "_vim",
    "-colorscheme",
];

/// Sanitizes a repository name by removing common theme-related suffixes.
fn sanitize_repo_name(repo_name: &str) -> String {
    let mut candidate = repo_name.to_lowercase().trim().to_string();

    for suffix in SUFFIXES_TO_STRIP {
        if candidate.ends_with(suffix) && candidate.len() > suffix.len() {
            candidate = candidate[..candidate.len() - suffix.len()].to_string();
        }
    }

    // Strip leading/trailing dashes and underscores
    candidate = candidate.trim_matches(|c| c == '-' || c == '_').to_string();

    candidate
}

/// Normalizes a full repository name (owner/repo) to a theme name.
pub fn normalize_theme_name(full_repo: &str) -> String {
    let slash_index = full_repo.find('/');
    let (owner, repo_name) = match slash_index {
        Some(idx) => (&full_repo[..idx], &full_repo[idx + 1..]),
        None => ("", full_repo),
    };

    let cleaned_repo = sanitize_repo_name(repo_name);
    let invalid_names: HashSet<&str> = ["", "nvim", "vim", "neovim", "theme", "colorscheme"]
        .into_iter()
        .collect();

    if invalid_names.contains(cleaned_repo.as_str()) {
        let fallback = sanitize_repo_name(owner);
        if !fallback.is_empty() {
            return fallback;
        }
    }

    if cleaned_repo.is_empty() {
        let fallback = sanitize_repo_name(owner);
        if !fallback.is_empty() {
            return fallback;
        }
        return "theme".to_string();
    }

    cleaned_repo
}

/// Extracts colorscheme names from GitHub tree items.
pub fn extract_colorschemes(tree_items: &[GitHubTreeItem]) -> Vec<String> {
    let regex = regex::Regex::new(COLORS_FILE_PATTERN).expect("Invalid regex pattern");
    let mut colors = HashSet::new();

    for item in tree_items {
        if item.item_type != "blob" {
            continue;
        }

        if let Some(caps) = regex.captures(&item.path) {
            if let Some(colorscheme) = caps.get(1) {
                let name = colorscheme.as_str().trim().to_string();
                if !name.is_empty() {
                    colors.insert(name);
                }
            }
        }
    }

    let mut result: Vec<String> = colors.into_iter().collect();
    result.sort();
    result
}

/// Picks the base colorscheme from a list based on theme name matching.
fn pick_base_colorscheme(theme_name: &str, colors: &[String]) -> String {
    if colors.is_empty() {
        return theme_name.to_string();
    }

    let preferred: HashSet<String> = [
        theme_name.to_string(),
        theme_name.replace('-', "_"),
        theme_name.replace('_', "-"),
    ]
    .into_iter()
    .collect();

    // First, try to match preferred names
    for candidate in colors {
        if preferred.contains(candidate) {
            return candidate.clone();
        }
    }

    // Then, prefer names without separators
    for candidate in colors {
        if !candidate.contains('-') && !candidate.contains('_') {
            return candidate.clone();
        }
    }

    colors.first().expect("colors is non-empty").clone()
}

/// Builds a ThemeEntry from repository metadata and colorschemes.
pub fn build_entry(repo_payload: &GitHubRepoItem, colorschemes: &[String]) -> ThemeEntry {
    let full_name = &repo_payload.full_name;

    let theme_name = normalize_theme_name(full_name);
    let base_colorscheme = pick_base_colorscheme(&theme_name, colorschemes);

    let variants: Vec<ThemeVariant> = colorschemes
        .iter()
        .filter(|c| *c != &base_colorscheme)
        .map(|value| ThemeVariant {
            name: value.clone(),
            colorscheme: value.clone(),
            variant: None,
            meta: None,
        })
        .collect();

    let topics = repo_payload
        .topics
        .iter()
        .filter(|t| !t.is_empty())
        .cloned()
        .collect();

    ThemeEntry {
        name: theme_name,
        repo: full_name.clone(),
        colorscheme: base_colorscheme,
        description: repo_payload.description.clone(),
        stars: Some(repo_payload.stargazers_count),
        topics: Some(topics),
        updated_at: Some(repo_payload.updated_at.clone()),
        archived: Some(repo_payload.archived),
        disabled: Some(repo_payload.disabled),
        homepage: None,
        meta: None,
        variants: if variants.is_empty() {
            None
        } else {
            Some(variants)
        },
        aliases: None,
        deps: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_theme_name() {
        assert_eq!(normalize_theme_name("folke/tokyonight.nvim"), "tokyonight");
        assert_eq!(normalize_theme_name("catppuccin/nvim"), "catppuccin");
        assert_eq!(normalize_theme_name("rebelot/kanagawa.nvim"), "kanagawa");
    }

    #[test]
    fn test_extract_colorschemes() {
        let items = vec![
            GitHubTreeItem {
                path: "colors/tokyonight.lua".to_string(),
                mode: "100644".to_string(),
                item_type: "blob".to_string(),
                sha: "abc".to_string(),
                size: Some(100),
                url: None,
            },
            GitHubTreeItem {
                path: "colors/tokyonight-night.lua".to_string(),
                mode: "100644".to_string(),
                item_type: "blob".to_string(),
                sha: "def".to_string(),
                size: Some(100),
                url: None,
            },
            GitHubTreeItem {
                path: "README.md".to_string(),
                mode: "100644".to_string(),
                item_type: "blob".to_string(),
                sha: "ghi".to_string(),
                size: Some(100),
                url: None,
            },
        ];

        let colors = extract_colorschemes(&items);
        assert_eq!(colors, vec!["tokyonight", "tokyonight-night"]);
    }
}
