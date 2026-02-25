//! Watch command implementation.

use std::path::Path;

use crate::commands::{CommandResult, failure};
use crate::config::Config;
use crate::logger::set_log_level;
use crate::runner::run_loop;

/// Options for the watch command.
pub struct WatchOptions {
    pub config: String,
    pub verbose: bool,
    pub token: Option<String>,
}

/// Executes the watch command.
pub async fn watch(options: WatchOptions) -> CommandResult {
    let config = Config::load(Path::new(&options.config));

    if options.verbose {
        set_log_level("DEBUG");
    }

    match run_loop(&config, options.token).await {
        Ok(()) => failure("Watch loop exited unexpectedly", 1),
        Err(e) => failure(format!("Watch failed: {}", e), 1),
    }
}
