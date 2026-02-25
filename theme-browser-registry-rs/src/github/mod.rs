//! GitHub module - API client and theme parsing.

mod client;
mod parser;

pub use client::{GitHubClient, GitHubClientOptions, GitHubRequestError};
pub use parser::{build_entry, extract_colorschemes, normalize_theme_name};
