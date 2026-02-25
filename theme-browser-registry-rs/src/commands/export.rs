//! Export command implementation.

use std::path::Path;

use crate::commands::{CommandResult, failure, success};
use crate::config::Config;
use crate::db::RepoCache;
use crate::types::DbExport;

/// Options for the export command.
pub struct ExportOptions {
    pub config: String,
}

/// Executes the export command.
pub async fn export(options: ExportOptions) -> CommandResult {
    let config = Config::load(Path::new(&options.config));

    let cache = match RepoCache::new(Path::new(&config.output.cache)).await {
        Ok(c) => c,
        Err(e) => return failure(format!("Failed to open database: {}", e), 1),
    };

    let entries = match cache.list_all().await {
        Ok(e) => e,
        Err(e) => return failure(format!("Failed to list entries: {}", e), 1),
    };

    let db_export = DbExport {
        count: entries.len(),
        entries: entries
            .into_iter()
            .map(|e| crate::types::DbExportEntry {
                repo: e.repo,
                updated_at: e.updated_at,
                scanned_at: e.scanned_at,
                payload: e.payload,
                parse_error: e.parse_error,
            })
            .collect(),
        exported_at: chrono::Utc::now().to_rfc3339(),
    };

    let output_path = Path::new("artifacts/db-export.json");
    if let Err(e) = crate::runner::write_json(output_path, &db_export) {
        return failure(format!("Failed to write export: {}", e), 1);
    }

    success(format!("Exported {} entries to {:?}", db_export.count, output_path))
}
