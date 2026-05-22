use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};
use std::io::{BufRead, BufReader};
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallLogPayload {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub git: bool,
    pub brew: bool,
    pub gh: bool,
}

#[tauri::command]
pub async fn check_dependencies(simulate: Option<bool>) -> Result<DependencyStatus, String> {
    if simulate.unwrap_or(false) {
        return Ok(DependencyStatus { git: false, brew: false, gh: false });
    }

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

#[tauri::command]
pub async fn install_dependency(app: AppHandle, tool: String, simulate: bool) -> Result<(), String> {
    let emit_log = |msg: &str| {
        let _ = app.emit("install-log", InstallLogPayload { message: msg.to_string() });
    };

    if simulate {
        emit_log(&format!("Starting simulated installation for {}...", tool));
        sleep(Duration::from_millis(1000)).await;
        emit_log("Downloading packages (0%)...");
        sleep(Duration::from_millis(1000)).await;
        emit_log("Downloading packages (50%)...");
        sleep(Duration::from_millis(1000)).await;
        emit_log("Downloading packages (100%)...");
        sleep(Duration::from_millis(500)).await;
        emit_log("Extracting files...");
        sleep(Duration::from_millis(1500)).await;
        emit_log("Configuring paths...");
        sleep(Duration::from_millis(1000)).await;
        emit_log(&format!("Successfully installed {} (Simulated)!", tool));
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let package = if tool == "git" { "Git.Git" } else if tool == "gh" { "GitHub.cli" } else { return Err("Unknown tool".to_string()) };
        emit_log(&format!("Running winget to install {}...", package));
        
        let mut child = Command::new("winget")
            .args(["install", "--silent", "--accept-source-agreements", "--accept-package-agreements", package])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start winget: {}", e))?;

        if let Some(stdout) = child.stdout.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_clone.emit("install-log", InstallLogPayload { message: line });
                }
            });
        }
        
        if let Some(stderr) = child.stderr.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_clone.emit("install-log", InstallLogPayload { message: format!("ERROR: {}", line) });
                }
            });
        }

        let status = child.wait().map_err(|e| format!("Failed to wait on winget: {}", e))?;
        if status.success() {
            emit_log("Installation completed successfully.");
            Ok(())
        } else {
            Err(format!("Installation failed with status: {}", status))
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        let (cmd, args) = if tool == "git" {
            ("xcode-select", vec!["--install"])
        } else if tool == "gh" {
            ("brew", vec!["install", "gh"])
        } else {
            return Err("Unknown tool".to_string());
        };

        emit_log(&format!("Running {} {:?}...", cmd, args));
        
        let mut child = Command::new(cmd)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start command: {}", e))?;

        if let Some(stdout) = child.stdout.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_clone.emit("install-log", InstallLogPayload { message: line });
                }
            });
        }
        
        if let Some(stderr) = child.stderr.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_clone.emit("install-log", InstallLogPayload { message: format!("ERROR: {}", line) });
                }
            });
        }

        let status = child.wait().map_err(|e| format!("Failed to wait on command: {}", e))?;
        if status.success() {
            emit_log("Installation completed successfully.");
            Ok(())
        } else {
            Err(format!("Installation failed with status: {}", status))
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err("Unsupported OS for auto-installation".to_string());
    }
}
