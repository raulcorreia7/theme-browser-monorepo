//! Command result types.

/// Result of a command execution.
pub type CommandResult = Result<String, String>;

/// Creates a successful command result.
pub fn success(message: impl Into<String>) -> CommandResult {
    Ok(message.into())
}

/// Creates a failed command result.
pub fn failure(message: impl Into<String>, _code: i32) -> CommandResult {
    Err(message.into())
}
