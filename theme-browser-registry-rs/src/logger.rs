//! Logging configuration using tracing.

use std::sync::Once;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static INIT: Once = Once::new();

/// Initializes the logging system.
pub fn init_logging(level: &str) {
    INIT.call_once(|| {
        let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level));

        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_subscriber::fmt::layer().with_target(false))
            .init();
    });
}

/// Sets the log level at runtime (note: this is a no-op after init).
pub fn set_log_level(_level: &str) {
    // Tracing doesn't support runtime level changes easily after init.
    // For now, this is a no-op. The level is set at init time.
}
