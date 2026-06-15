mod commands;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub fn find_git_executable() -> String {
    // 1. PATH環境変数で "git" が動くか確認
    if check_command_in_path("git", &["--version"]) {
        return "git".to_string();
    }

    // 2. 標準インストール先をOSごとに探索
    #[cfg(target_os = "windows")]
    {
        let paths = [
            "C:\\Program Files\\Git\\cmd\\git.exe",
            "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
        ];
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let user_local = format!("{}\\AppData\\Local\\Programs\\Git\\cmd\\git.exe", profile);
            if std::path::Path::new(&user_local).exists() && check_command_in_path(&user_local, &["--version"]) {
                return user_local;
            }
        }
        for path in &paths {
            if std::path::Path::new(path).exists() && check_command_in_path(path, &["--version"]) {
                return path.to_string();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let paths = [
            "/usr/bin/git",
            "/usr/local/bin/git",
            "/opt/homebrew/bin/git",
        ];
        for path in &paths {
            if std::path::Path::new(path).exists() && check_command_in_path(path, &["--version"]) {
                return path.to_string();
            }
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let paths = [
            "/usr/bin/git",
            "/usr/local/bin/git",
        ];
        for path in &paths {
            if std::path::Path::new(path).exists() && check_command_in_path(path, &["--version"]) {
                return path.to_string();
            }
        }
    }

    "git".to_string()
}

fn check_command_in_path(cmd: &str, args: &[&str]) -> bool {
    let mut command = std::process::Command::new(cmd);
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000);
    }
    match command.args(args).status() {
        Ok(status) => status.success(),
        Err(_) => false,
    }
}

pub struct SafeCommand;

impl SafeCommand {
    pub fn new<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
        let program_str = program.as_ref().to_string_lossy();
        let resolved = if program_str == "git" {
            std::ffi::OsString::from(find_git_executable())
        } else {
            program.as_ref().to_os_string()
        };

        let mut cmd = std::process::Command::new(resolved);
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW = 0x08000000
        }
        cmd
    }
}

pub struct SafeTokioCommand;

impl SafeTokioCommand {
    pub fn new<S: AsRef<std::ffi::OsStr>>(program: S) -> tokio::process::Command {
        let program_str = program.as_ref().to_string_lossy();
        let resolved = if program_str == "git" {
            std::ffi::OsString::from(find_git_executable())
        } else {
            program.as_ref().to_os_string()
        };

        let mut cmd = tokio::process::Command::new(resolved);
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW = 0x08000000
        }
        cmd
    }
}


use commands::setup::{check_dependencies, install_dependency};
use commands::git::{git_init, git_commit, git_log, update_gitignore, switch_git_mode, git_get_current_branch, git_create_branch, git_get_branches, git_checkout, git_diff_file, git_merge_to_main, git_get_conflicts, git_resolve_conflict, git_merge_abort, git_show_file_content, git_diff_file_commit, git_delete_branch, git_rename_branch, git_get_remote, git_set_remote, git_push, git_pull, git_get_uncommitted_files};
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
            git_rename_branch,
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
