use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use dunce::canonicalize;
use log::{info, error};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum GitMode {
    Whitelist,
    Blacklist,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub git_mode: GitMode,
    /// Whitelistモードで追跡するエントリ（「!ファイル名」形式、「!.gitignore」は除く）
    #[serde(default)]
    pub whitelist_entries: Vec<String>,
    /// Blacklistモードで無視するエントリ（ファイル名やパターン）
    #[serde(default)]
    pub blacklist_entries: Vec<String>,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            git_mode: GitMode::Blacklist,
            whitelist_entries: Vec::new(),
            blacklist_entries: Vec::new(),
        }
    }
}

const CONFIG_FILE_NAME: &str = ".file-timemachine.json";

#[tauri::command]
pub async fn get_project_config(root_path: String) -> Result<ProjectConfig, String> {
    let path = PathBuf::from(&root_path);
    let config_path = path.join(CONFIG_FILE_NAME);

    if !config_path.exists() {
        info!("Config file not found at {:?}, returning default", config_path);
        return Ok(ProjectConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| {
            error!("Failed to read config file: {}", e);
            format!("Failed to read config file: {}", e)
        })?;

    let config: ProjectConfig = serde_json::from_str(&content)
        .map_err(|e| {
            error!("Failed to parse config file: {}", e);
            format!("Failed to parse config file: {}", e)
        })?;

    info!("Loaded project config from {:?}", config_path);
    Ok(config)
}

#[tauri::command]
pub async fn set_project_config(root_path: String, config: ProjectConfig) -> Result<(), String> {
    let path = canonicalize(PathBuf::from(&root_path))
        .map_err(|e| {
            error!("Failed to canonicalize path: {}", e);
            format!("Failed to canonicalize path: {}", e)
        })?;
    let config_path = path.join(CONFIG_FILE_NAME);

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| {
            error!("Failed to serialize config: {}", e);
            format!("Failed to serialize config: {}", e)
        })?;

    fs::write(&config_path, content)
        .map_err(|e| {
            error!("Failed to write config file: {}", e);
            format!("Failed to write config file: {}", e)
        })?;

    info!("Saved project config to {:?}", config_path);
    Ok(())
}
