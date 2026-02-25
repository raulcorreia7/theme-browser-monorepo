//! CLI argument parsing using clap.

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "theme-browser-registry")]
#[command(about = "Rust theme registry indexer for theme-browser.nvim")]
#[command(version)]
pub struct Cli {
    /// Path to configuration file
    #[arg(short, long, global = true, default_value = "config.json")]
    pub config: String,

    /// Enable verbose output
    #[arg(short, long, global = true)]
    pub verbose: bool,

    /// GitHub token (overrides GITHUB_TOKEN env var)
    #[arg(long, global = true, env = "GITHUB_TOKEN")]
    pub token: Option<String>,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Sync themes from GitHub once
    Sync,

    /// Continuously sync themes (watch mode)
    Watch,

    /// Sync themes and publish to git
    Publish,

    /// Export database to JSON
    Export,
}

impl Cli {
    pub fn parse_args() -> Self {
        Self::parse()
    }
}
