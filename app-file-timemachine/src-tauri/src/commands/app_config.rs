use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;
use log::{info, error};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub last_opened_folder: Option<String>,
    pub settings_save_behavior: Option<String>,
    pub setup_completed: Option<bool>,
    pub settings_theme: Option<String>,
    pub settings_auto_scan: Option<bool>,
}

const APP_CONFIG_FILE_NAME: &str = "app_config.json";

#[tauri::command]
pub async fn get_app_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| {
        error!("Failed to get app config dir: {}", e);
        format!("Failed to get app config dir: {}", e)
    })?;

    let config_path = config_dir.join(APP_CONFIG_FILE_NAME);

    if !config_path.exists() {
        info!("App config file not found at {:?}, returning default", config_path);
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&config_path).map_err(|e| {
        error!("Failed to read app config file: {}", e);
        format!("Failed to read app config file: {}", e)
    })?;

    let config: AppConfig = serde_json::from_str(&content).map_err(|e| {
        error!("Failed to parse app config file: {}", e);
        format!("Failed to parse app config file: {}", e)
    })?;

    info!("Loaded app config from {:?}", config_path);
    Ok(config)
}

#[tauri::command]
pub async fn set_app_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| {
        error!("Failed to get app config dir: {}", e);
        format!("Failed to get app config dir: {}", e)
    })?;

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| {
            error!("Failed to create app config dir: {}", e);
            format!("Failed to create app config dir: {}", e)
        })?;
    }

    let config_path = config_dir.join(APP_CONFIG_FILE_NAME);

    let content = serde_json::to_string_pretty(&config).map_err(|e| {
        error!("Failed to serialize app config: {}", e);
        format!("Failed to serialize app config: {}", e)
    })?;

    fs::write(&config_path, content).map_err(|e| {
        error!("Failed to write app config file: {}", e);
        format!("Failed to write app config file: {}", e)
    })?;

    info!("Saved app config to {:?}", config_path);
    Ok(())
}
