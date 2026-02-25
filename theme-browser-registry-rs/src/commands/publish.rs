//! Publish command implementation.

use std::path::Path;

use crate::commands::{CommandResult, failure, success};
use crate::config::Config;
use crate::runner::run_once;

/// Options for the publish command.
pub struct PublishOptions {
    pub config: String,
    pub verbose: bool,
    pub token: Option<String>,
}

/// Executes the publish command.
pub async fn publish(options: PublishOptions) -> CommandResult {
    let config = Config::load(Path::new(&options.config));

    if options.verbose {
        crate::logger::set_log_level("DEBUG");
    }

    if !config.publish.enabled {
        return failure("Publishing is disabled in config (publish.enabled=false)", 1);
    }

    match run_once(&config, options.token).await {
        Ok(stats) => {
            if stats.errors > 0 {
                return failure(
                    format!("Sync completed with {} errors, skipping publish", stats.errors),
                    1,
                );
            }

            if let Err(e) = git_add_and_commit(&config) {
                return failure(format!("Git operations failed: {}", e), 1);
            }

            success(format!("Published {} themes", stats.written))
        }
        Err(e) => failure(format!("Sync failed: {}", e), 1),
    }
}

fn git_add_and_commit(config: &Config) -> Result<(), String> {
    use std::process::Command;

    let status = Command::new("git")
        .args(["add", &config.output.themes, &config.output.manifest])
        .status()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !status.success() {
        return Err("git add failed".to_string());
    }

    let status = Command::new("git")
        .args(["commit", "-m", &config.publish.git.message])
        .status()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    if !status.success() {
        return Ok(());
    }

    let status = Command::new("git")
        .args(["push", &config.publish.git.remote, &config.publish.git.branch])
        .status()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !status.success() {
        return Err("git push failed".to_string());
    }

    Ok(())
}
