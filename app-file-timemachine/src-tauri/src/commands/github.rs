use std::process::Command;
use log::{info, error};

/// GitHub CLI (`gh`) が認証済みの場合、そのアクセストークンを自動的に取得して返すコマンド。
/// 取得できない場合はエラーメッセージを返します。
#[tauri::command]
pub async fn github_import_cli_token() -> Result<String, String> {
    info!("GitHub CLIからのトークン自動インポートを開始します");

    // Windowsでghコマンドが実行可能かチェックしつつ実行
    // cmd /c gh auth token もしくは直接 gh auth token
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "gh auth token"])
            .output()
    } else {
        Command::new("gh")
            .arg("auth")
            .arg("token")
            .output()
    };

    match output {
        Ok(out) => {
            if out.status.success() {
                let token = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if token.is_empty() {
                    error!("GitHub CLIのトークンが空です");
                    return Err("GitHub CLIのトークンが取得できませんでした。gh auth login を実行しているか確認してください。".to_string());
                }
                info!("GitHub CLIからトークンの取得に成功しました");
                Ok(token)
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                error!("GitHub CLIコマンドが失敗しました: {}", stderr);
                Err(format!("GitHub CLIからトークンを取得できませんでした。\n詳細: {}", stderr))
            }
        }
        Err(e) => {
            error!("GitHub CLIコマンドの実行に失敗しました: {}", e);
            Err("GitHub CLI (`gh` コマンド) がPCにインストールされていないか、PATHが通っていません。".to_string())
        }
    }
}
