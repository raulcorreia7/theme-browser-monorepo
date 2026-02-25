//! GitHub API client using octorust with built-in rate limiting.

use octorust::auth::Credentials;
use octorust::{Client, ClientError};
use std::env;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::warn;

use crate::types::{GitHubRepoItem, GitHubTreeItem};

/// Error type for GitHub API requests.
#[derive(Debug, thiserror::Error)]
pub enum GitHubRequestError {
    #[error("GitHub API error: {0}")]
    ApiError(String),
    #[error("Invalid repository format: {0}")]
    InvalidFormat(String),
    #[error("Repository not found")]
    NotFound,
}

impl From<ClientError> for GitHubRequestError {
    fn from(e: ClientError) -> Self {
        let err_str = e.to_string();
        if err_str.contains("404") {
            return GitHubRequestError::NotFound;
        }
        GitHubRequestError::ApiError(err_str)
    }
}

/// Configuration options for the GitHub client.
#[derive(Debug, Clone)]
pub struct GitHubClientOptions {
    /// Maximum concurrent requests
    pub concurrency: usize,
    /// Delay between requests in milliseconds
    pub delay_ms: u64,
    /// Maximum retries
    pub retry_limit: u8,
    /// Optional GitHub token
    pub token: Option<String>,
}

impl Default for GitHubClientOptions {
    fn default() -> Self {
        Self {
            concurrency: 5,
            delay_ms: 250,
            retry_limit: 3,
            token: None,
        }
    }
}

/// Client for interacting with the GitHub API.
#[derive(Clone)]
pub struct GitHubClient {
    client: Client,
    semaphore: Arc<Semaphore>,
}

impl GitHubClient {
    /// Creates a new GitHub client instance.
    pub fn new(options: GitHubClientOptions) -> Result<Self, GitHubRequestError> {
        let token = options
            .token
            .or_else(|| env::var("GITHUB_TOKEN").ok())
            .filter(|t| !t.trim().is_empty());

        let has_token = token.is_some();
        let credentials: Option<Credentials> = token.map(Credentials::Token);

        let user_agent = "theme-browser-registry";
        let client = Client::new(user_agent, credentials).map_err(|e| {
            GitHubRequestError::ApiError(format!("Failed to create client: {}", e))
        })?;

        let semaphore = Arc::new(Semaphore::new(options.concurrency));

        tracing::info!(
            "GitHub client initialized: authenticated={}, concurrency={}",
            has_token,
            options.concurrency
        );

        Ok(Self { client, semaphore })
    }

    /// Searches for repositories by topic.
    pub async fn search_repositories(
        &self,
        topic: &str,
        page: u32,
        per_page: u8,
    ) -> Result<(Vec<GitHubRepoItem>, bool), GitHubRequestError> {
        let _permit = self.semaphore.acquire().await.unwrap();
        
        use octorust::types::{Order, SearchReposSort};

        let query = format!("topic:{} archived:false fork:false", topic);

        let result = self
            .client
            .search()
            .repos(
                &query,
                SearchReposSort::Updated,
                Order::Desc,
                per_page as i64,
                page as i64,
            )
            .await;

        match result {
            Ok(response) => {
                let items: Vec<GitHubRepoItem> = response
                    .body
                    .items
                    .into_iter()
                    .map(|item| GitHubRepoItem {
                        id: item.id,
                        full_name: item.full_name,
                        description: if item.description.is_empty() {
                            None
                        } else {
                            Some(item.description)
                        },
                        stargazers_count: item.stargazers_count as u32,
                        topics: item.topics,
                        updated_at: item.updated_at.map(|dt| dt.to_rfc3339()).unwrap_or_default(),
                        archived: item.archived,
                        disabled: item.disabled,
                        html_url: item.html_url,
                        default_branch: if item.default_branch.is_empty() {
                            None
                        } else {
                            Some(item.default_branch)
                        },
                    })
                    .collect();

                let has_next = items.len() == per_page as usize;
                Ok((items, has_next))
            }
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("404") {
                    return Ok((vec![], false));
                }
                warn!("GitHub search error: {}", err_str);
                Err(GitHubRequestError::from(e))
            }
        }
    }

    /// Fetches metadata for a specific repository.
    pub async fn fetch_repository(&self, repo: &str) -> Result<Option<GitHubRepoItem>, GitHubRequestError> {
        let _permit = self.semaphore.acquire().await.unwrap();
        let (owner, repo_name) = split_repo(repo)?;

        let result = self.client.repos().get(&owner, &repo_name).await;

        match result {
            Ok(repo_data) => {
                let data = repo_data.body;
                Ok(Some(GitHubRepoItem {
                    id: data.id,
                    full_name: data.full_name,
                    description: if data.description.is_empty() {
                        None
                    } else {
                        Some(data.description)
                    },
                    stargazers_count: data.stargazers_count as u32,
                    topics: data.topics,
                    updated_at: data.updated_at.map(|dt| dt.to_rfc3339()).unwrap_or_default(),
                    archived: data.archived,
                    disabled: data.disabled,
                    html_url: data.html_url,
                    default_branch: if data.default_branch.is_empty() {
                        None
                    } else {
                        Some(data.default_branch)
                    },
                }))
            }
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("404") {
                    return Ok(None);
                }
                warn!("GitHub fetch repository error for {}: {}", repo, err_str);
                Err(GitHubRequestError::from(e))
            }
        }
    }

    /// Fetches the git tree for a repository at a specific ref.
    pub async fn fetch_repository_tree(
        &self,
        repo: &str,
        ref_name: &str,
    ) -> Result<Vec<GitHubTreeItem>, GitHubRequestError> {
        let _permit = self.semaphore.acquire().await.unwrap();
        let (owner, repo_name) = split_repo(repo)?;

        let result = self
            .client
            .git()
            .get_tree(&owner, &repo_name, ref_name, "1")
            .await;

        match result {
            Ok(tree) => {
                let items: Vec<GitHubTreeItem> = tree
                    .body
                    .tree
                    .into_iter()
                    .map(|item| GitHubTreeItem {
                        path: item.path,
                        mode: item.mode,
                        item_type: item.type_,
                        sha: item.sha,
                        size: if item.size > 0 { Some(item.size as u64) } else { None },
                        url: if item.url.is_empty() { None } else { Some(item.url) },
                    })
                    .collect();
                Ok(items)
            }
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("404") {
                    return Ok(vec![]);
                }
                warn!("GitHub fetch tree error for {}: {}", repo, err_str);
                Err(GitHubRequestError::from(e))
            }
        }
    }
}

fn split_repo(repo: &str) -> Result<(String, String), GitHubRequestError> {
    let parts: Vec<&str> = repo.split('/').collect();
    if parts.len() != 2 {
        return Err(GitHubRequestError::InvalidFormat(repo.to_string()));
    }
    Ok((parts[0].to_string(), parts[1].to_string()))
}
