use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub git: bool,
    pub brew: bool,
    pub gh: bool,
}

#[tauri::command]
pub async fn check_dependencies() -> Result<DependencyStatus, String> {
    let git = check_command("git", &["--version"]);
    let brew = check_command("brew", &["--version"]);
    let gh = check_command("gh", &["--version"]);

    Ok(DependencyStatus { git, brew, gh })
}

fn check_command(cmd: &str, args: &[&str]) -> bool {
    match Command::new(cmd).args(args).status() {
        Ok(status) => status.success(),
        Err(_) => false,
    }
}
