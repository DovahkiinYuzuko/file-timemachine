mod commands;

use commands::setup::check_dependencies;
use commands::git::{git_init, git_commit, git_log, update_gitignore, switch_git_mode, git_get_current_branch, git_create_branch};
use commands::files::{get_file_tree, get_file_info};
use commands::config::{get_project_config, set_project_config};
use commands::app_config::{get_app_config, set_app_config};
use commands::preview::read_file_content;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new()
            .targets([
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
            ])
            .build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_dependencies,
            git_init,
            git_commit,
            git_log,
            update_gitignore,
            switch_git_mode,
            git_get_current_branch,
            git_create_branch,
            get_file_tree,
            get_file_info,
            get_project_config,
            set_project_config,
            get_app_config,
            set_app_config,
            read_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
