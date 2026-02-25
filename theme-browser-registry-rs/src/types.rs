//! Core types for theme-browser-registry.
//!
//! All types derive serde traits for JSON serialization/deserialization.
//! Matches the TypeScript Zod schemas.

use serde::{Deserialize, Serialize};

/// Theme loading strategies
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoadStrategy {
    ColorschemeOnly,
    Load,
    SetupColorscheme,
    SetupLoad,
    VimgColorscheme,
}

impl Default for LoadStrategy {
    fn default() -> Self {
        Self::ColorschemeOnly
    }
}

/// Adapter types for theme loading
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoadAdapter {
    Load,
    SetupLoad,
    Use,
}

impl Default for LoadAdapter {
    fn default() -> Self {
        Self::Load
    }
}

/// Background color preference
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Background {
    Dark,
    Light,
}

/// Theme metadata for advanced loading
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ThemeMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strategy: Option<LoadStrategy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter: Option<LoadAdapter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opts: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opts_g: Option<std::collections::HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opts_o: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<Background>,
}

/// Theme variant (e.g., different color schemes for same theme)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeVariant {
    pub name: String,
    pub colorscheme: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<ThemeMeta>,
}

/// Main theme entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeEntry {
    pub name: String,
    pub repo: String,
    pub colorscheme: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stars: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topics: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<ThemeMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variants: Option<Vec<ThemeVariant>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deps: Option<Vec<String>>,
}

/// Manifest file for themes.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub count: u32,
    pub generated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

/// GitHub repository item from API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepoItem {
    pub id: i64,
    pub full_name: String,
    pub description: Option<String>,
    pub stargazers_count: u32,
    #[serde(default)]
    pub topics: Vec<String>,
    pub updated_at: String,
    pub archived: bool,
    pub disabled: bool,
    pub html_url: String,
    pub default_branch: Option<String>,
}

/// GitHub tree item from API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubTreeItem {
    pub path: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub sha: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Repository cache entry (matches TS RepoCacheEntry)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoCacheEntry {
    pub repo: String,
    pub updated_at: String,
    pub scanned_at: i64,
    pub payload: Option<ThemeEntry>,
    pub parse_error: Option<String>,
}

/// Database export entry (matches TS DbExportEntry)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbExportEntry {
    pub repo: String,
    pub updated_at: String,
    pub scanned_at: i64,
    pub payload: Option<ThemeEntry>,
    pub parse_error: Option<String>,
}

/// Database export (matches TS DbExport)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbExport {
    pub count: usize,
    pub entries: Vec<DbExportEntry>,
    pub exported_at: String,
}

/// Run statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RunStats {
    pub discovered: u32,
    pub scheduled: u32,
    pub batches: u32,
    pub fetched: u32,
    pub cached: u32,
    pub errors: u32,
    pub written: u32,
}

impl std::fmt::Display for RunStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "discovered={} scheduled={} batches={} fetched={} cached={} errors={} written={}",
            self.discovered,
            self.scheduled,
            self.batches,
            self.fetched,
            self.cached,
            self.errors,
            self.written
        )
    }
}
