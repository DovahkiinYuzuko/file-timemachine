use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;
use std::fs;
use log::{info, debug};
use super::config::GitMode;

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitLog {
    pub hash: String,
    pub timestamp: i64,
    pub message: String,
}

#[tauri::command]
pub async fn update_gitignore(
    root_path: String,
    target_path: String,
    is_ignored: bool,
    mode: GitMode,
) -> Result<(), String> {
    let repo_path = dunce::canonicalize(Path::new(&root_path))
        .map_err(|e| format!("ルートパスの正規化に失敗したよ: {}", e))?;
    let target_abs_path = dunce::canonicalize(Path::new(&target_path))
        .map_err(|e| format!("ターゲットパスの正規化に失敗したよ: {}", e))?;
    
    // 相対パスを取得（gitで使う形式に合わせる）
    let rel_path = target_abs_path.strip_prefix(&repo_path)
        .map_err(|_| "ターゲットパスがルートの下にないよ".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    
    let gitignore_path = repo_path.join(".gitignore");
    let content = if gitignore_path.exists() {
        fs::read_to_string(&gitignore_path).map_err(|e| format!(".gitignoreの読み込みに失敗したよ: {}", e))?
    } else {
        String::new()
    };

    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    
    match mode {
        GitMode::Blacklist => {
            if is_ignored {
                // 無視したい場合：エントリがなければ追加
                if !lines.iter().any(|l| l.trim() == rel_path) {
                    lines.push(rel_path.clone());
                }
            } else {
                // 無視を解除したい場合：エントリを削除
                lines.retain(|l| l.trim() != rel_path);
            }
        }
        GitMode::Whitelist => {
            // linesの中に "*" が含まれているかチェック
            let has_all_ignore = lines.iter().any(|l| l.trim() == "*");
            if !has_all_ignore {
                // "*" が無ければ、先頭に挿入する
                lines.insert(0, "*".to_string());
                // さらに、.gitignore 自体は無視しないように設定しておく
                if !lines.iter().any(|l| l.trim() == "!.gitignore") {
                    if lines.len() > 1 {
                        lines.insert(1, "!.gitignore".to_string());
                    } else {
                        lines.push("!.gitignore".to_string());
                    }
                }
            }

            let entry = format!("!{}", rel_path);
            if !is_ignored {
                // 無視を解除したい（ホワイトリストに入れる）場合：!エントリがなければ追加
                if !lines.iter().any(|l| l.trim() == entry) {
                    lines.push(entry);
                }
            } else {
                // 無視したい場合：!エントリを削除
                lines.retain(|l| l.trim() != entry);
            }
        }
    }

    let new_content = lines.join("\n") + "\n";
    fs::write(&gitignore_path, new_content)
        .map_err(|e| format!(".gitignoreの保存に失敗したよ: {}", e))?;

    info!(".gitignoreを更新したよ: mode={:?}, path={}, is_ignored={}", mode, rel_path, is_ignored);
    Ok(())
}

/// モード切り替え時に .gitignore をリセットするコマンド。
/// 新しいモード（new_mode）に合わせて .gitignore の内容を初期化する。
/// - Blacklist モード：全エントリを削除して空にする
/// - Whitelist モード：「*」と「!.gitignore」だけの初期状態にする
#[tauri::command]
pub async fn reset_gitignore(
    root_path: String,
    new_mode: GitMode,
) -> Result<(), String> {
    let repo_path = dunce::canonicalize(Path::new(&root_path))
        .map_err(|e| format!("ルートパスの正規化に失敗したよ: {}", e))?;

    let gitignore_path = repo_path.join(".gitignore");

    let new_content = match new_mode {
        GitMode::Blacklist => {
            // Blacklistモードでは .gitignore を空にする（全ファイルを追跡対象にする）
            info!("Blacklistモードにリセット: .gitignoreを空にします");
            String::new()
        }
        GitMode::Whitelist => {
            // Whitelistモードでは「*」と「!.gitignore」のみの初期状態にする
            info!("Whitelistモードにリセット: .gitignoreを初期ホワイトリスト状態にします");
            "*\n!.gitignore\n".to_string()
        }
    };

    fs::write(&gitignore_path, new_content)
        .map_err(|e| format!(".gitignoreのリセットに失敗したよ: {}", e))?;

    info!(".gitignoreをリセットしたよ: new_mode={:?}", new_mode);
    Ok(())
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;
    
    info!("Gitリポジトリを初期化します: {:?}", repo_path);

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // すでに .git がある場合はスキップ
    if repo_path.join(".git").exists() {
        debug!(".git ディレクトリが既に存在するため、初期化をスキップします。");
    } else {
        // git init
        let status = Command::new("git")
            .arg("init")
            .current_dir(&repo_path)
            .status()
            .map_err(|e| format!("git initに失敗しました: {}", e))?;

        if !status.success() {
            return Err("git initコマンドが失敗しました。".to_string());
        }
    }

    // .gitignoreの生成 (存在しない場合のみ)
    let gitignore_path = repo_path.join(".gitignore");
    if !gitignore_path.exists() {
        debug!(".gitignore を作成します (ホワイトリスト方式)");
        let default_gitignore = "*\n!.gitignore\n!*.docx\n!*.xlsx\n!*.pptx\n!*.pdf\n!*.psd\n!*.ai\n!*.png\n!*.jpg\n!*.txt\n!*.md";
        fs::write(&gitignore_path, default_gitignore)
            .map_err(|e| format!(".gitignoreの生成に失敗しました: {}", e))?;
    }

    Ok("Gitリポジトリの準備が完了しました。".to_string())
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    info!("コミットを実行します: {:?}, メッセージ: {}", repo_path, message);

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git add .
    let add_status = Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(&repo_path)
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
        .current_dir(&repo_path)
        .status()
        .map_err(|e| format!("git commitに失敗しました: {}", e))?;

    if !commit_status.success() {
        return Err("git commitに失敗しました。変更がない可能性があります。".to_string());
    }

    Ok("コミットが完了しました。".to_string())
}

#[tauri::command]
pub async fn git_log(path: String) -> Result<Vec<CommitLog>, String> {
    let raw_path = Path::new(&path);
    // canonicalize は存在しないパスで失敗するので、とりあえずパスがあればOK
    let repo_path = if raw_path.exists() {
        dunce::canonicalize(raw_path).unwrap_or_else(|_| raw_path.to_path_buf())
    } else {
        raw_path.to_path_buf()
    };

    debug!("Gitログを取得します: {:?}", repo_path);

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git log --pretty=format:"%H_#_%at_#_%s"
    let output = Command::new("git")
        .arg("log")
        .arg("--pretty=format:%H_#_%at_#_%s")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git logの実行に失敗しました: {}", e))?;

    if !output.status.success() {
        debug!("コミット履歴が見つかりませんでした。");
        return Ok(Vec::new());
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
