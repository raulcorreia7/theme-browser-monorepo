//! Sync command implementation.

use std::path::Path;

use crate::commands::{CommandResult, failure, success};
use crate::config::Config;
use crate::logger::set_log_level;
use crate::runner::run_once;

/// Options for the sync command.
pub struct SyncOptions {
    pub config: String,
    pub verbose: bool,
    pub token: Option<String>,
}

/// Executes the sync command.
pub async fn sync(options: SyncOptions) -> CommandResult {
    let config = Config::load(Path::new(&options.config));

    if options.verbose {
        set_log_level("DEBUG");
    }

    match run_once(&config, options.token).await {
        Ok(stats) => {
            println!("{}", serde_json::to_string_pretty(&stats).unwrap_or_default());
            
            if stats.errors > 0 {
                return failure(
                    format!("Sync completed with {} errors", stats.errors),
                    1,
                );
            }

            success(format!("Synced {} themes", stats.written))
        }
        Err(e) => failure(format!("Sync failed: {}", e), 1),
    }
}
