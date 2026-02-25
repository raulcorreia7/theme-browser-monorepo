//! Repository cache operations using SeaORM.

use sea_orm::*;
use std::path::Path;

use crate::types::{RepoCacheEntry, ThemeEntry};

/// Persistent cache for repository metadata.
#[derive(Clone)]
pub struct RepoCache {
    db: DatabaseConnection,
}

impl RepoCache {
    /// Creates a new RepoCache instance, initializing the database if needed.
    pub async fn new(db_path: &Path) -> Result<Self, DbErr> {
        if let Some(parent) = db_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    DbErr::Custom(format!("Failed to create database directory: {}", e))
                })?;
            }
        }

        let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
        let db = Database::connect(&db_url).await?;

        Self::create_table_if_not_exists(&db).await?;

        Ok(Self { db })
    }

    async fn create_table_if_not_exists(db: &DatabaseConnection) -> Result<(), DbErr> {
        let sql = r#"
            CREATE TABLE IF NOT EXISTS repo_cache (
                repo TEXT PRIMARY KEY NOT NULL,
                updated_at TEXT NOT NULL,
                scanned_at INTEGER NOT NULL,
                payload_json TEXT NOT NULL,
                parse_error TEXT
            )
        "#;
        db.execute_unprepared(sql).await?;
        Ok(())
    }

    /// Reads a cached repository entry.
    pub async fn read_repo(&self, repo: &str) -> Result<Option<RepoCacheEntry>, DbErr> {
        let sql = "SELECT repo, updated_at, scanned_at, payload_json, parse_error FROM repo_cache WHERE repo = ?";
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Sqlite,
            sql,
            [Value::from(repo)],
        );

        if let Some(row) = self.db.query_one(stmt).await? {
            let repo: String = row.try_get("", "repo")?;
            let updated_at: String = row.try_get("", "updated_at")?;
            let scanned_at: i64 = row.try_get("", "scanned_at")?;
            let payload_json: String = row.try_get("", "payload_json")?;
            let parse_error: Option<String> = row.try_get("", "parse_error")?;

            let payload = self.parse_payload(&payload_json);

            return Ok(Some(RepoCacheEntry {
                repo,
                updated_at,
                scanned_at,
                payload,
                parse_error,
            }));
        }

        Ok(None)
    }

    /// Stores or updates a repository entry in the cache.
    pub async fn upsert_repo(
        &self,
        repo: &str,
        updated_at: &str,
        payload: &ThemeEntry,
        parse_error: Option<&str>,
    ) -> Result<(), DbErr> {
        let scanned_at = chrono::Utc::now().timestamp();
        let payload_json = serde_json::to_string(payload)
            .map_err(|e| DbErr::Custom(format!("Failed to serialize payload: {}", e)))?;

        let sql = r#"
            INSERT INTO repo_cache (repo, updated_at, scanned_at, payload_json, parse_error)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(repo) DO UPDATE SET
                updated_at = excluded.updated_at,
                scanned_at = excluded.scanned_at,
                payload_json = excluded.payload_json,
                parse_error = excluded.parse_error
        "#;

        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Sqlite,
            sql,
            [
                Value::from(repo),
                Value::from(updated_at),
                Value::from(scanned_at),
                Value::from(payload_json),
                Value::from(parse_error.map(|s| s.to_string())),
            ],
        );

        self.db.execute(stmt).await?;
        Ok(())
    }

    /// Determines whether a repository should be refreshed.
    pub async fn should_refresh(
        &self,
        repo: &str,
        discovered_updated_at: &str,
        stale_after_days: u16,
    ) -> Result<bool, DbErr> {
        let existing = self.read_repo(repo).await?;

        match existing {
            None => Ok(true),
            Some(entry) => {
                if entry.parse_error.is_some() {
                    return Ok(true);
                }

                if !discovered_updated_at.is_empty() && entry.updated_at != discovered_updated_at {
                    return Ok(true);
                }

                let stale_seconds = stale_after_days as i64 * 86400;
                let now = chrono::Utc::now().timestamp();
                Ok(now - entry.scanned_at >= stale_seconds)
            }
        }
    }

    /// Lists all valid theme payloads from the cache.
    pub async fn list_payloads(&self) -> Result<Vec<ThemeEntry>, DbErr> {
        let sql = "SELECT payload_json FROM repo_cache WHERE parse_error IS NULL";
        let stmt = Statement::from_sql_and_values(DatabaseBackend::Sqlite, sql, []);

        let rows = self.db.query_all(stmt).await?;
        let mut payloads = Vec::new();

        for row in rows {
            let payload_json: String = row.try_get("", "payload_json")?;
            if let Some(entry) = self.parse_payload(&payload_json) {
                if !entry.name.is_empty() && !entry.repo.is_empty() && !entry.colorscheme.is_empty() {
                    payloads.push(entry);
                }
            }
        }

        Ok(payloads)
    }

    /// Lists all entries from the cache.
    pub async fn list_all(&self) -> Result<Vec<RepoCacheEntry>, DbErr> {
        let sql = "SELECT repo, updated_at, scanned_at, payload_json, parse_error FROM repo_cache";
        let stmt = Statement::from_sql_and_values(DatabaseBackend::Sqlite, sql, []);

        let rows = self.db.query_all(stmt).await?;
        let mut entries = Vec::new();

        for row in rows {
            let repo: String = row.try_get("", "repo")?;
            let updated_at: String = row.try_get("", "updated_at")?;
            let scanned_at: i64 = row.try_get("", "scanned_at")?;
            let payload_json: String = row.try_get("", "payload_json")?;
            let parse_error: Option<String> = row.try_get("", "parse_error")?;

            let payload = self.parse_payload(&payload_json);

            entries.push(RepoCacheEntry {
                repo,
                updated_at,
                scanned_at,
                payload,
                parse_error,
            });
        }

        Ok(entries)
    }

    /// Parses a payload from JSON.
    fn parse_payload(&self, json: &str) -> Option<ThemeEntry> {
        serde_json::from_str(json).ok()
    }
}
