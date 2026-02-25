//! Configuration loading with nested structure matching TS version.

use serde::Deserialize;
use std::path::Path;

/// Log level options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
}

impl Default for LogLevel {
    fn default() -> Self {
        Self::Info
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warning => write!(f, "WARNING"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}

/// Discovery pagination settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryPagination {
    #[serde(default = "default_per_page")]
    pub per_page: u8,
    #[serde(default = "default_max_pages_per_topic")]
    pub max_pages_per_topic: u8,
}

fn default_per_page() -> u8 {
    100
}
fn default_max_pages_per_topic() -> u8 {
    5
}

impl Default for DiscoveryPagination {
    fn default() -> Self {
        Self {
            per_page: default_per_page(),
            max_pages_per_topic: default_max_pages_per_topic(),
        }
    }
}

/// Discovery settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Discovery {
    #[serde(default = "default_topics")]
    pub topics: Vec<String>,
    #[serde(default)]
    pub include_repos: Vec<String>,
    #[serde(default)]
    pub pagination: DiscoveryPagination,
}

fn default_topics() -> Vec<String> {
    vec![
        "neovim-colorscheme".into(),
        "nvim-theme".into(),
        "vim-colorscheme".into(),
    ]
}

impl Default for Discovery {
    fn default() -> Self {
        Self {
            topics: default_topics(),
            include_repos: Vec::new(),
            pagination: DiscoveryPagination::default(),
        }
    }
}

/// GitHub rate limit settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubRateLimit {
    #[serde(default = "default_delay_ms")]
    pub delay_ms: u64,
    #[serde(default = "default_retry_limit")]
    pub retry_limit: u8,
}

fn default_delay_ms() -> u64 {
    250
}
fn default_retry_limit() -> u8 {
    3
}

impl Default for GithubRateLimit {
    fn default() -> Self {
        Self {
            delay_ms: default_delay_ms(),
            retry_limit: default_retry_limit(),
        }
    }
}

/// GitHub settings
#[derive(Debug, Clone, Deserialize)]
pub struct Github {
    #[serde(default)]
    pub rate_limit: GithubRateLimit,
}

impl Default for Github {
    fn default() -> Self {
        Self {
            rate_limit: GithubRateLimit::default(),
        }
    }
}

/// Processing batch settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingBatch {
    #[serde(default = "default_batch_size")]
    pub size: usize,
    #[serde(default)]
    pub pause_ms: u64,
}

fn default_batch_size() -> usize {
    50
}

impl Default for ProcessingBatch {
    fn default() -> Self {
        Self {
            size: default_batch_size(),
            pause_ms: 0,
        }
    }
}

/// Processing settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Processing {
    #[serde(default)]
    pub batch: ProcessingBatch,
    #[serde(default = "default_concurrency")]
    pub concurrency: usize,
    #[serde(default)]
    pub max_repos_per_run: usize,
}

fn default_concurrency() -> usize {
    5
}

impl Default for Processing {
    fn default() -> Self {
        Self {
            batch: ProcessingBatch::default(),
            concurrency: default_concurrency(),
            max_repos_per_run: 0,
        }
    }
}

/// Filter settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Filters {
    #[serde(default)]
    pub min_stars: u32,
    #[serde(default = "default_true")]
    pub skip_archived: bool,
    #[serde(default = "default_true")]
    pub skip_disabled: bool,
    #[serde(default = "default_stale_after_days")]
    pub stale_after_days: u16,
}

fn default_stale_after_days() -> u16 {
    14
}
fn default_true() -> bool {
    true
}

impl Default for Filters {
    fn default() -> Self {
        Self {
            min_stars: 0,
            skip_archived: true,
            skip_disabled: true,
            stale_after_days: default_stale_after_days(),
        }
    }
}

/// Output settings
#[derive(Debug, Clone, Deserialize)]
pub struct Output {
    #[serde(default = "default_themes_path")]
    pub themes: String,
    #[serde(default = "default_manifest_path")]
    pub manifest: String,
    #[serde(default = "default_cache_path")]
    pub cache: String,
}

fn default_themes_path() -> String {
    "artifacts/themes.json".into()
}
fn default_manifest_path() -> String {
    "artifacts/manifest.json".into()
}
fn default_cache_path() -> String {
    ".state/indexer.db".into()
}

impl Default for Output {
    fn default() -> Self {
        Self {
            themes: default_themes_path(),
            manifest: default_manifest_path(),
            cache: default_cache_path(),
        }
    }
}

/// Runtime settings
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Runtime {
    #[serde(default = "default_scan_interval_seconds")]
    pub scan_interval_seconds: u64,
    #[serde(default)]
    pub log_level: LogLevel,
}

fn default_scan_interval_seconds() -> u64 {
    1800
}

impl Default for Runtime {
    fn default() -> Self {
        Self {
            scan_interval_seconds: default_scan_interval_seconds(),
            log_level: LogLevel::Info,
        }
    }
}

/// Sort settings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortBy {
    Stars,
    #[serde(rename = "updated_at")]
    UpdatedAt,
    Name,
}

impl Default for SortBy {
    fn default() -> Self {
        Self::Stars
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

impl Default for SortOrder {
    fn default() -> Self {
        Self::Desc
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Sort {
    #[serde(default)]
    pub by: SortBy,
    #[serde(default)]
    pub order: SortOrder,
}

impl Default for Sort {
    fn default() -> Self {
        Self {
            by: SortBy::Stars,
            order: SortOrder::Desc,
        }
    }
}

/// Publish git settings
#[derive(Debug, Clone, Deserialize)]
pub struct PublishGit {
    #[serde(default = "default_git_remote")]
    pub remote: String,
    #[serde(default = "default_git_branch")]
    pub branch: String,
    #[serde(default = "default_git_message")]
    pub message: String,
}

fn default_git_remote() -> String {
    "origin".into()
}
fn default_git_branch() -> String {
    "master".into()
}
fn default_git_message() -> String {
    "chore(registry): publish latest index artifacts".into()
}

impl Default for PublishGit {
    fn default() -> Self {
        Self {
            remote: default_git_remote(),
            branch: default_git_branch(),
            message: default_git_message(),
        }
    }
}

/// Publish settings
#[derive(Debug, Clone, Deserialize)]
pub struct Publish {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub git: PublishGit,
}

impl Default for Publish {
    fn default() -> Self {
        Self {
            enabled: false,
            git: PublishGit::default(),
        }
    }
}

/// Complete configuration matching TS version
#[derive(Debug, Clone, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub discovery: Discovery,
    #[serde(default)]
    pub github: Github,
    #[serde(default)]
    pub processing: Processing,
    #[serde(default)]
    pub filters: Filters,
    #[serde(default)]
    pub output: Output,
    #[serde(default = "default_overrides_path")]
    pub overrides: String,
    #[serde(default)]
    pub runtime: Runtime,
    #[serde(default)]
    pub sort: Sort,
    #[serde(default)]
    pub publish: Publish,
}

fn default_overrides_path() -> String {
    "overrides.json".into()
}

impl Config {
    /// Load configuration from a JSON file, merging with defaults.
    pub fn load(path: &Path) -> Self {
        if !path.exists() {
            return Self::default();
        }

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return Self::default(),
        };

        let raw: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => return Self::default(),
        };

        // Parse with defaults
        serde_json::from_value(raw).unwrap_or_default()
    }
}
