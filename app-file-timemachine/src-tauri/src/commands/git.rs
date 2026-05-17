use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitLog {
    pub hash: String,
    pub timestamp: i64,
    pub message: String,
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<String, String> {
    let repo_path = Path::new(&path);
    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git init
    let status = Command::new("git")
        .arg("init")
        .current_dir(repo_path)
        .status()
        .map_err(|e| format!("git initに失敗しました: {}", e))?;

    if !status.success() {
        return Err("git initコマンドが失敗しました。".to_string());
    }

    // .gitignoreの生成 (存在しない場合のみ)
    let gitignore_path = repo_path.join(".gitignore");
    if !gitignore_path.exists() {
        let default_gitignore = "*\n!.gitignore\n!*.docx\n!*.xlsx\n!*.pptx\n!*.pdf\n!*.psd\n!*.ai\n!*.png\n!*.jpg\n!*.txt\n!*.md";
        fs::write(&gitignore_path, default_gitignore)
            .map_err(|e| format!(".gitignoreの生成に失敗しました: {}", e))?;
    }

    Ok("Gitリポジトリを初期化しました。".to_string())
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo_path = Path::new(&path);
    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git add .
    let add_status = Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(repo_path)
        .status()
        .map_err(|e| format!("git addに失敗しました: {}", e))?;

    if !add_status.success() {
        return Err("git addに失敗しました。".to_string());
    }

    // git commit
    let commit_status = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(&message)
        .current_dir(repo_path)
        .status()
        .map_err(|e| format!("git commitに失敗しました: {}", e))?;

    if !commit_status.success() {
        // コミットするものがない場合は成功とみなすかエラーにするか検討が必要だが、
        // 今回はシンプルにエラーとして返す
        return Err("git commitに失敗しました。変更がない可能性があります。".to_string());
    }

    Ok("コミットが完了しました。".to_string())
}

#[tauri::command]
pub async fn git_log(path: String) -> Result<Vec<CommitLog>, String> {
    let repo_path = Path::new(&path);
    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git log --pretty=format:"%H_#_%at_#_%s"
    let output = Command::new("git")
        .arg("log")
        .arg("--pretty=format:%H_#_%at_#_%s")
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("git logの実行に失敗しました: {}", e))?;

    if !output.status.success() {
        return Ok(Vec::new()); // コミットがない場合は空配列を返す
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let logs = stdout
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split("_#_").collect();
            if parts.len() >= 3 {
                Some(CommitLog {
                    hash: parts[0].to_string(),
                    timestamp: parts[1].parse::<i64>().unwrap_or(0),
                    message: parts[2].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(logs)
}
