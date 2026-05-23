mod commands;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct SafeCommand;

impl SafeCommand {
    pub fn new<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
        let mut cmd = std::process::Command::new(program);
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW = 0x08000000
        }
        cmd
    }
}


use commands::setup::{check_dependencies, install_dependency};
use commands::git::{git_init, git_commit, git_log, update_gitignore, switch_git_mode, git_get_current_branch, git_create_branch, git_get_branches, git_checkout, git_diff_file, git_merge_to_main, git_get_conflicts, git_resolve_conflict, git_merge_abort, git_show_file_content, git_diff_file_commit, git_delete_branch, git_get_remote, git_set_remote, git_push, git_pull, git_get_uncommitted_files};
use commands::files::{get_file_tree, get_file_info};
use commands::config::{get_project_config, set_project_config};
use commands::app_config::{get_app_config, set_app_config};
use commands::github::github_import_cli_token;
use commands::preview::read_file_content;
use commands::watcher::{start_watching, stop_watching, WatcherState};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState { watcher: std::sync::Mutex::new(None) })
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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_dependencies,
            install_dependency,
            github_import_cli_token,
            git_get_remote,
            git_set_remote,
            git_push,
            git_pull,
            git_get_uncommitted_files,
            git_init,
            git_commit,
            git_log,
            update_gitignore,
            switch_git_mode,
            git_get_current_branch,
            git_create_branch,
            git_get_branches,
            git_checkout,
            git_diff_file,
            git_merge_to_main,
            git_get_conflicts,
            git_resolve_conflict,
            git_merge_abort,
            git_show_file_content,
            git_diff_file_commit,
            git_delete_branch,
            get_file_tree,
            get_file_info,
            get_project_config,
            set_project_config,
            get_app_config,
            set_app_config,
            read_file_content,
            start_watching,
            stop_watching
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
