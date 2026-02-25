//! Main orchestration for theme indexing.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::config::{Config, SortBy};
use crate::db::RepoCache;
use crate::github::{build_entry, extract_colorschemes, GitHubClient, GitHubClientOptions};
use crate::merge::{apply_overrides, load_overrides};
use crate::types::{RunStats, ThemeEntry};

/// Sanitizes a repository name.
pub fn safe_repo(repo: &str) -> String {
    repo.trim()
        .trim_end_matches(".git")
        .trim_matches('/')
        .to_string()
}

/// Selects repositories for processing, limited by max_repos_per_run.
pub fn select_repositories_for_run(
    discovered: &HashMap<String, String>,
    max_repos: usize,
) -> Vec<(String, String)> {
    let mut sorted: Vec<_> = discovered.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
    sorted.sort_by(|a, b| a.0.cmp(&b.0));

    if max_repos > 0 {
        sorted.truncate(max_repos);
    }

    sorted
}

/// Chunks items into batches of the given size.
pub fn chunk<T: Clone>(items: Vec<T>, size: usize) -> Vec<Vec<T>> {
    if size == 0 {
        return vec![items];
    }

    items.chunks(size).map(|c| c.to_vec()).collect()
}

/// Sorts entries based on config settings.
pub fn sort_entries(entries: Vec<ThemeEntry>, config: &Config) -> Vec<ThemeEntry> {
    let mut sorted = entries;

    sorted.sort_by(|a, b| {
        let cmp = match config.sort.by {
            SortBy::Name => {
                let a_name = a.name.to_lowercase();
                let b_name = b.name.to_lowercase();
                a_name.cmp(&b_name)
            }
            SortBy::UpdatedAt => {
                let a_date = a.updated_at.as_deref().unwrap_or("");
                let b_date = b.updated_at.as_deref().unwrap_or("");
                a_date.cmp(b_date)
            }
            SortBy::Stars => {
                let a_stars = a.stars.unwrap_or(0);
                let b_stars = b.stars.unwrap_or(0);
                a_stars.cmp(&b_stars)
            }
        };

        match config.sort.order {
            crate::config::SortOrder::Desc => cmp.reverse(),
            crate::config::SortOrder::Asc => cmp,
        }
    });

    sorted
}

/// Writes JSON to a file, creating parent directories if needed.
pub fn write_json(path: &Path, payload: &impl serde::Serialize) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(payload)?;
    std::fs::write(path, content + "\n")?;

    Ok(())
}

/// Writes the manifest file with checksum.
pub fn write_manifest(manifest_path: &Path, output_path: &Path, count: usize) -> std::io::Result<()> {
    let raw = std::fs::read(output_path)?;
    let checksum = format!("{:x}", Sha256::digest(&raw));

    let manifest = crate::types::Manifest {
        count: count as u32,
        generated_at: chrono::Utc::now().to_rfc3339(),
        sha256: Some(checksum),
    };

    write_json(manifest_path, &manifest)
}

/// Discovers repositories from GitHub topics in parallel.
async fn discover_repositories(
    client: &GitHubClient,
    config: &Config,
) -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let discovered = Arc::new(Mutex::new(HashMap::new()));

    // Parallel topic discovery
    let mut handles = vec![];
    for topic in &config.discovery.topics {
        let client = client.clone();
        let config = config.clone();
        let discovered = Arc::clone(&discovered);
        let topic = topic.clone();

        info!(
            "discover topic={} perPage={} maxPagesPerTopic={}",
            topic,
            config.discovery.pagination.per_page,
            config.discovery.pagination.max_pages_per_topic
        );

        handles.push(tokio::spawn(async move {
            let mut page = 1u32;
            let mut has_next = true;

            while has_next {
                let result = client
                    .search_repositories(&topic, page, config.discovery.pagination.per_page)
                    .await;

                let (items, next) = match result {
                    Ok(r) => r,
                    Err(e) => {
                        warn!("Failed to search topic {}: {}", topic, e);
                        break;
                    }
                };

                let is_empty = items.is_empty();

                {
                    let mut map = discovered.lock().await;
                    for item in items {
                        let repo = safe_repo(&item.full_name);
                        if !repo.is_empty() && !map.contains_key(&repo) {
                            map.insert(repo, item.updated_at.clone());
                        }
                    }
                }

                has_next = next
                    && (config.discovery.pagination.max_pages_per_topic == 0
                        || page <= config.discovery.pagination.max_pages_per_topic as u32);
                page += 1;

                if is_empty {
                    break;
                }
            }
        }));
    }

    for handle in handles {
        let _ = handle.await;
    }

    // Add include_repos
    {
        let mut map = discovered.lock().await;
        for repo in &config.discovery.include_repos {
            let normalized = safe_repo(repo);
            if !normalized.is_empty() && !map.contains_key(&normalized) {
                map.insert(normalized, String::new());
            }
        }
    }

    let result = discovered.lock().await.clone();
    info!(
        "discover completed topics={} repos={}",
        config.discovery.topics.len(),
        result.len()
    );

    Ok(result)
}

/// Builds a theme entry for a single repository.
async fn build_entry_for_repo(
    client: &GitHubClient,
    config: &Config,
    repo: &str,
) -> Result<ThemeEntry, String> {
    let repo_payload = client
        .fetch_repository(repo)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "repository metadata not found".to_string())?;

    if repo_payload.stargazers_count < config.filters.min_stars {
        return Err(format!(
            "below minStars ({} < {})",
            repo_payload.stargazers_count, config.filters.min_stars
        ));
    }

    if config.filters.skip_archived && repo_payload.archived {
        return Err("repository archived".to_string());
    }

    if config.filters.skip_disabled && repo_payload.disabled {
        return Err("repository disabled".to_string());
    }

    let ref_name = repo_payload.default_branch.clone().unwrap_or_else(|| "HEAD".to_string());
    let tree_items = client
        .fetch_repository_tree(repo, &ref_name)
        .await
        .map_err(|e| e.to_string())?;

    let colorschemes = extract_colorschemes(&tree_items);
    Ok(build_entry(&repo_payload, &colorschemes))
}

/// Processes a batch of repositories concurrently with worker pattern.
async fn process_batch(
    batch: &[(String, String)],
    client: GitHubClient,
    config: Config,
    cache: RepoCache,
    entries_by_repo: Arc<Mutex<HashMap<String, ThemeEntry>>>,
    stats: Arc<Mutex<RunStats>>,
) {
    let queue = Arc::new(Mutex::new(batch.to_vec()));
    let worker_count = config.processing.concurrency.min(batch.len());
    
    info!("Starting {} workers for batch of {} items", worker_count, batch.len());
    
    let mut handles = vec![];

    for worker_id in 0..worker_count {
        let client = client.clone();
        let config = config.clone();
        let cache = cache.clone();
        let entries = Arc::clone(&entries_by_repo);
        let stats = Arc::clone(&stats);
        let queue = Arc::clone(&queue);

        let handle = tokio::spawn(async move {
            debug!("Worker {} started", worker_id);
            loop {
                let item = {
                    let mut q = queue.lock().await;
                    q.pop()
                };

                let Some((repo, discovered_updated_at)) = item else {
                    debug!("Worker {} finished - queue empty", worker_id);
                    break;
                };

                debug!("Worker {} processing {}", worker_id, repo);

                let should_refresh = cache
                    .should_refresh(&repo, &discovered_updated_at, config.filters.stale_after_days)
                    .await
                    .unwrap_or(true);

                if !should_refresh {
                    if let Ok(Some(entry)) = cache.read_repo(&repo).await {
                        if let Some(ref theme) = entry.payload {
                            entries.lock().await.insert(repo.clone(), theme.clone());
                            stats.lock().await.cached += 1;
                            continue;
                        }
                    }
                }

                match build_entry_for_repo(&client, &config, &repo).await {
                    Ok(entry) => {
                        let updated_at = entry.updated_at.clone().unwrap_or_default();
                        if let Err(e) = cache.upsert_repo(&repo, &updated_at, &entry, None).await {
                            warn!("Failed to cache {}: {}", repo, e);
                        }
                        entries.lock().await.insert(repo.clone(), entry);
                        stats.lock().await.fetched += 1;
                    }
                    Err(e) => {
                        let empty_entry = ThemeEntry {
                            name: String::new(),
                            repo: repo.clone(),
                            colorscheme: String::new(),
                            description: None,
                            stars: None,
                            topics: None,
                            updated_at: None,
                            archived: None,
                            disabled: None,
                            homepage: None,
                            meta: None,
                            variants: None,
                            aliases: None,
                            deps: None,
                        };
                        let _ = cache.upsert_repo(&repo, &discovered_updated_at, &empty_entry, Some(&e)).await;
                        stats.lock().await.errors += 1;
                        warn!("repo processing failed repo={} error={}", repo, e);
                    }
                }
            }
        });

        handles.push(handle);
    }

    for handle in handles {
        let _ = handle.await;
    }
    
    info!("All workers completed for batch");
}

/// Runs a single sync operation.
pub async fn run_once(config: &Config, token: Option<String>) -> Result<RunStats, Box<dyn std::error::Error>> {
    let client = GitHubClient::new(GitHubClientOptions {
        concurrency: config.processing.concurrency,
        delay_ms: config.github.rate_limit.delay_ms,
        retry_limit: config.github.rate_limit.retry_limit,
        token,
    })?;

    let cache = RepoCache::new(Path::new(&config.output.cache)).await?;
    let stats = Arc::new(Mutex::new(RunStats::default()));
    let entries_by_repo = Arc::new(Mutex::new(HashMap::new()));

    // Load existing payloads from cache
    {
        let payloads = cache.list_payloads().await?;
        let mut entries = entries_by_repo.lock().await;
        for payload in payloads {
            entries.insert(payload.repo.clone(), payload);
        }
        debug!("loaded payloads from state count={}", entries.len());
    }

    // Discover repositories (parallel)
    info!("Starting repository discovery...");
    let discovered = discover_repositories(&client, config).await?;
    let discovered_count = discovered.len();
    stats.lock().await.discovered = discovered_count as u32;
    info!("Discovery finished: {} repos found", discovered_count);

    let scheduled = select_repositories_for_run(&discovered, config.processing.max_repos_per_run);
    let scheduled_count = scheduled.len();
    stats.lock().await.scheduled = scheduled_count as u32;

    info!(
        "run plan discovered={} scheduled={} batchSize={} batchPauseMs={} requestDelayMs={}",
        discovered_count,
        scheduled_count,
        config.processing.batch.size,
        config.processing.batch.pause_ms,
        config.github.rate_limit.delay_ms
    );

    if scheduled.is_empty() {
        info!("No repositories to process");
        return Ok(stats.lock().await.clone());
    }

    // Process in batches
    let batch_groups = chunk(scheduled, config.processing.batch.size);
    let total_batches = batch_groups.len();
    
    info!("Created {} batches", total_batches);

    for (batch_index, batch) in batch_groups.iter().enumerate() {
        stats.lock().await.batches += 1;
        info!(
            "processing batch={}/{} size={} concurrency={}",
            batch_index + 1,
            total_batches,
            batch.len(),
            config.processing.concurrency
        );

        process_batch(
            batch,
            client.clone(),
            config.clone(),
            cache.clone(),
            Arc::clone(&entries_by_repo),
            Arc::clone(&stats),
        )
        .await;

        // Write checkpoint
        let entries: Vec<_> = entries_by_repo.lock().await.values().cloned().collect();
        let entries_count = entries.len();
        let overrides_result = load_overrides(Path::new(&config.overrides));
        info!("Loaded {} overrides from {}", overrides_result.overrides.len(), config.overrides);
        let merged = apply_overrides(entries, &overrides_result.overrides, &overrides_result.excluded);
        info!("After merge: {} entries (before: {})", merged.len(), entries_count);
        let sorted_entries = sort_entries(merged, config);

        let valid_entries: Vec<_> = sorted_entries
            .into_iter()
            .filter(|e| !e.name.is_empty() && !e.colorscheme.is_empty())
            .collect();

        write_json(Path::new(&config.output.themes), &valid_entries)?;
        write_manifest(Path::new(&config.output.manifest), Path::new(&config.output.themes), valid_entries.len())?;

        stats.lock().await.written = valid_entries.len() as u32;
        debug!(
            "batch checkpoint written batch={}/{} entries={}",
            batch_index + 1,
            total_batches,
            valid_entries.len()
        );

        if config.processing.batch.pause_ms > 0 && batch_index < total_batches - 1 {
            let pause_secs = config.processing.batch.pause_ms / 1000;
            debug!("batch pause sleep={}s", pause_secs);
            tokio::time::sleep(std::time::Duration::from_millis(config.processing.batch.pause_ms)).await;
        }
    }

    let final_stats = stats.lock().await.clone();
    info!(
        "run complete discovered={} scheduled={} batches={} fetched={} cached={} errors={} written={}",
        final_stats.discovered,
        final_stats.scheduled,
        final_stats.batches,
        final_stats.fetched,
        final_stats.cached,
        final_stats.errors,
        final_stats.written
    );

    Ok(final_stats)
}

/// Runs the sync loop continuously.
pub async fn run_loop(config: &Config, token: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    loop {
        let start = std::time::Instant::now();
        info!("loop iteration started");

        match run_once(config, token.clone()).await {
            Ok(stats) => {
                let took = start.elapsed().as_secs();
                info!("loop iteration finished duration={}s stats={}", took, serde_json::to_string(&stats).unwrap_or_default());
            }
            Err(e) => {
                warn!("loop iteration failed: {}", e);
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(config.runtime.scan_interval_seconds)).await;
    }
}
