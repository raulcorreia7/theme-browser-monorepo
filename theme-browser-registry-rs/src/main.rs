//! Theme Browser Registry - Rust implementation
//!
//! Discovers Neovim colorschemes from GitHub and produces a searchable index.

use std::path::Path;

use theme_browser_registry::cli::{Cli, Commands};
use theme_browser_registry::commands::export::export;
use theme_browser_registry::commands::publish::publish;
use theme_browser_registry::commands::sync::sync;
use theme_browser_registry::commands::watch::watch;
use theme_browser_registry::config::Config;
use theme_browser_registry::logger::init_logging;

#[tokio::main]
async fn main() {
    // Load .env file if present (doesn't override existing env vars)
    dotenvy::dotenv().ok();

    let args = Cli::parse_args();

    // Load config to get log level
    let config = Config::load(Path::new(&args.config));
    let log_level = match config.runtime.log_level {
        theme_browser_registry::config::LogLevel::Debug => "DEBUG",
        theme_browser_registry::config::LogLevel::Info => "INFO",
        theme_browser_registry::config::LogLevel::Warning => "WARN",
        theme_browser_registry::config::LogLevel::Error => "ERROR",
    };

    // Override with DEBUG if verbose flag is set
    let level = if args.verbose { "DEBUG" } else { log_level };
    init_logging(level);

    let token = args.token.clone();

    let result = match args.command {
        Commands::Sync => sync(theme_browser_registry::commands::sync::SyncOptions {
            config: args.config,
            verbose: args.verbose,
            token,
        })
        .await,
        Commands::Watch => watch(theme_browser_registry::commands::watch::WatchOptions {
            config: args.config,
            verbose: args.verbose,
            token,
        })
        .await,
        Commands::Publish => {
            publish(theme_browser_registry::commands::publish::PublishOptions {
                config: args.config,
                verbose: args.verbose,
                token,
            })
            .await
        }
        Commands::Export => export(theme_browser_registry::commands::export::ExportOptions {
            config: args.config,
        })
        .await,
    };

    match result {
        Ok(message) => {
            println!("{}", message);
            std::process::exit(0);
        }
        Err(error) => {
            eprintln!("Error: {}", error);
            std::process::exit(1);
        }
    }
}
