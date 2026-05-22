use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;
use std::fs;
use log::{info, debug, error};
use super::config::{GitMode, ProjectConfig, get_project_config, set_project_config};
use super::preview::{FilePreviewContent, parse_file_content_bytes};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitLog {
    pub hash: String,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
    pub timestamp: i64,
    pub message: String,
}

#[tauri::command]
pub async fn update_gitignore(
    root_path: String,
    target_path: String,
    is_ignored: bool,
    is_dir: bool,
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
    
    // ディレクトリの場合は「dir/」と「dir/**」を管理するパターンを生成する。
    // 「dir/」だけでは中のファイルはホワイトリストに入らないため両方必要。
    let patterns: Vec<String> = if is_dir {
        vec![format!("{}/", rel_path), format!("{}/**", rel_path)]
    } else {
        vec![rel_path.clone()]
    };
    
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
                // 無視したい場合：パターンがなければ追加
                for pat in &patterns {
                    if !lines.iter().any(|l| l.trim() == pat.as_str()) {
                        lines.push(pat.clone());
                    }
                }
            } else {
                // 無視を解除したい場合：パターンを全て削除
                lines.retain(|l| !patterns.iter().any(|p| l.trim() == p.as_str()));
            }
        }
        GitMode::Whitelist => {
            // 「*」がなければ先頭に挿入し、「!.gitignore」も保証する
            let has_all_ignore = lines.iter().any(|l| l.trim() == "*");
            if !has_all_ignore {
                lines.insert(0, "*".to_string());
                if !lines.iter().any(|l| l.trim() == "!.gitignore") {
                    if lines.len() > 1 {
                        lines.insert(1, "!.gitignore".to_string());
                    } else {
                        lines.push("!.gitignore".to_string());
                    }
                }
            }

            // ホワイトリストエントリは「!パターン」形式
            let wl_patterns: Vec<String> = patterns.iter().map(|p| format!("!{}", p)).collect();

            if !is_ignored {
                // ホワイトリストに入れる（無視を解除）：!パターンを追加
                for wp in &wl_patterns {
                    if !lines.iter().any(|l| l.trim() == wp.as_str()) {
                        lines.push(wp.clone());
                    }
                }
            } else {
                // ホワイトリストから外す（無視に戻す）：!パターンを全て削除
                lines.retain(|l| !wl_patterns.iter().any(|wp| l.trim() == wp.as_str()));
            }
        }
    }

    let new_content = lines.join("\n") + "\n";
    fs::write(&gitignore_path, new_content)
        .map_err(|e| format!(".gitignoreの保存に失敗したよ: {}", e))?;

    info!(".gitignoreを更新したよ: mode={:?}, path={}, is_ignored={}", mode, rel_path, is_ignored);
    Ok(())
}

/// モード切り替え時に .gitignore をキャッシュと同期しながら安全に切り替えるコマンド。
///
/// 処理フロー:
///  1. 既存の .gitignore を読み込む
///  2. 「*」の有無で現在の実効モードを判定し、ユーザー定義エントリを抽出
///  3. 現在モードのエントリを config にキャッシュとして保存
///  4. 新モードのキャッシュ済みエントリを config から取り出す
///  5. 新モード用の .gitignore を再構築して書き出す
///  6. git_mode を更新して config を保存
#[tauri::command]
pub async fn switch_git_mode(
    root_path: String,
    new_mode: GitMode,
) -> Result<(), String> {
    let repo_path = dunce::canonicalize(Path::new(&root_path))
        .map_err(|e| format!("ルートパスの正規化に失敗したよ: {}", e))?;
    let gitignore_path = repo_path.join(".gitignore");

    // ── Step 1: 既存 .gitignore を読み込む ──────────────────────────────
    let content = if gitignore_path.exists() {
        fs::read_to_string(&gitignore_path)
            .map_err(|e| format!(".gitignoreの読み込みに失敗したよ: {}", e))?
    } else {
        String::new()
    };
    let lines: Vec<&str> = content.lines().collect();

    // ── Step 2: 現在の実効モードを判定 & ユーザーエントリを抽出 ────────
    // 「*」が含まれていれば Whitelist モード、なければ Blacklist モード
    let is_currently_whitelist = lines.iter().any(|l| l.trim() == "*");
    let current_user_entries: Vec<String> = if is_currently_whitelist {
        // Whitelistのユーザーエントリ: 「!」で始まり「!.gitignore」ではないもの
        lines
            .iter()
            .filter(|l| {
                let t = l.trim();
                t.starts_with('!') && t != "!.gitignore"
            })
            .map(|l| l.to_string())
            .collect()
    } else {
        // Blacklistのユーザーエントリ: 空行・コメント・「*」・「!」で始まるもの を除いた行
        lines
            .iter()
            .filter(|l| {
                let t = l.trim();
                !t.is_empty() && !t.starts_with('#') && t != "*" && !t.starts_with('!')
            })
            .map(|l| l.to_string())
            .collect()
    };
    info!(
        "現在モード判定: {}, 抽出エントリ数: {}",
        if is_currently_whitelist { "whitelist" } else { "blacklist" },
        current_user_entries.len()
    );

    // ── Step 3: 現在モードのエントリを config にキャッシュ ───────────────
    let mut config: ProjectConfig = get_project_config(root_path.clone()).await?;
    if is_currently_whitelist {
        // 既存キャッシュが空の場合のみ上書き（意図しない消去防止）
        if config.whitelist_entries.is_empty() || !current_user_entries.is_empty() {
            config.whitelist_entries = current_user_entries;
        }
    } else {
        if config.blacklist_entries.is_empty() || !current_user_entries.is_empty() {
            config.blacklist_entries = current_user_entries;
        }
    }

    // ── Step 4: 新モードのキャッシュ済みエントリを取得 ──────────────────
    let new_entries = match new_mode {
        GitMode::Whitelist => config.whitelist_entries.clone(),
        GitMode::Blacklist => config.blacklist_entries.clone(),
    };

    // ── Step 5: 新モード用 .gitignore を再構築 ──────────────────────────
    let new_content = match new_mode {
        GitMode::Whitelist => {
            let mut result = vec!["*".to_string(), "!.gitignore".to_string()];
            result.extend(new_entries);
            result.join("\n") + "\n"
        }
        GitMode::Blacklist => {
            if new_entries.is_empty() {
                String::new()
            } else {
                new_entries.join("\n") + "\n"
            }
        }
    };
    fs::write(&gitignore_path, new_content)
        .map_err(|e| format!(".gitignoreの書き出しに失敗したよ: {}", e))?;

    // ── Step 6: git_mode を更新して config 保存 ─────────────────────────
    config.git_mode = new_mode.clone();
    set_project_config(root_path, config).await?;

    info!("switch_git_mode 完了: new_mode={:?}", new_mode);
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

    // 日本語や多言語のファイル名エスケープを防止する設定
    let _ = Command::new("git")
        .arg("config")
        .arg("core.quotepath")
        .arg("false")
        .current_dir(&repo_path)
        .status();

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

    // git log --all --pretty=format:"%H_#_%P_#_%d_#_%at_#_%s"
    let output = Command::new("git")
        .arg("log")
        .arg("--all")
        .arg("--pretty=format:%H_#_%P_#_%d_#_%at_#_%s")
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
            if parts.len() >= 5 {
                let hash = parts[0].to_string();
                
                // 親コミットハッシュのパース
                let parents = parts[1]
                    .split_whitespace()
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>();

                // refsのパース
                let refs_str = parts[2].trim();
                let mut refs = Vec::new();
                if !refs_str.is_empty() {
                    let cleaned = refs_str
                        .trim_start_matches('(')
                        .trim_end_matches(')');
                    for item in cleaned.split(',') {
                        let item_trimmed = item.trim();
                        if !item_trimmed.is_empty() {
                            let ref_name = if item_trimmed.starts_with("HEAD -> ") {
                                item_trimmed.trim_start_matches("HEAD -> ").to_string()
                            } else if item_trimmed.starts_with("tag: ") {
                                item_trimmed.trim_start_matches("tag: ").to_string()
                            } else {
                                item_trimmed.to_string()
                            };
                            refs.push(ref_name);
                        }
                    }
                }

                Some(CommitLog {
                    hash,
                    parents,
                    refs,
                    timestamp: parts[3].parse::<i64>().unwrap_or(0),
                    message: parts[4].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(logs)
}

#[tauri::command]
pub async fn git_get_current_branch(path: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git branch --show-current
    let output = Command::new("git")
        .arg("branch")
        .arg("--show-current")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git branchの実行に失敗しました: {}", e))?;

    if !output.status.success() {
        return Err("現在のブランチの取得に失敗しました。".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    // Initial repo with no commits might not return a branch name correctly in some git versions
    if stdout.is_empty() {
        return Ok("main".to_string());
    }

    Ok(stdout)
}

#[tauri::command]
pub async fn git_create_branch(path: String, branch_name: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    info!("新しいブランチを作成します: {} in {:?}", branch_name, repo_path);

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git checkout -b <branch_name>
    let status = Command::new("git")
        .arg("checkout")
        .arg("-b")
        .arg(&branch_name)
        .current_dir(&repo_path)
        .status()
        .map_err(|e| format!("git checkout -b に失敗しました: {}", e))?;

    if !status.success() {
        return Err(format!("ブランチ '{}' の作成に失敗しました。すでに存在するか、名前が無効かもしれません。", branch_name));
    }

    Ok(format!("ブランチ '{}' を作成し、切り替えました。", branch_name))
}

#[tauri::command]
pub async fn git_get_branches(path: String) -> Result<Vec<String>, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git branch --format="%(refname:short)"
    let output = Command::new("git")
        .arg("branch")
        .arg("--format=%(refname:short)")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git branchの実行に失敗しました: {}", e))?;

    if !output.status.success() {
        return Err("ブランチ一覧の取得に失敗しました。".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let branches: Vec<String> = stdout
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    Ok(branches)
}

#[tauri::command]
pub async fn git_checkout(path: String, branch: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    info!("ブランチ '{}' に切り替えます: {:?}", branch, repo_path);

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // git checkout <branch>
    let output = Command::new("git")
        .arg("checkout")
        .arg(&branch)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git checkout の実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ブランチ '{}' への切り替えに失敗しました。\n詳細: {}", branch, stderr));
    }

    Ok(format!("ブランチ '{}' に切り替えました。", branch))
}

#[tauri::command]
pub async fn git_diff_file(path: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    if !repo_path.exists() {
        return Err("無効なファイルパスです。".to_string());
    }

    // ディレクトリの場合は diff を取らない
    if repo_path.is_dir() {
        return Ok("".to_string());
    }

    // git diff HEAD -- <file>
    let output = Command::new("git")
        .arg("diff")
        .arg("HEAD")
        .arg("--")
        .arg(&repo_path)
        .current_dir(repo_path.parent().unwrap_or(Path::new(".")))
        .output()
        .map_err(|e| format!("git diff の実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Sometimes it fails if the repo has no commits, let's just return empty diff
        if stderr.contains("bad revision") || stderr.contains("ambiguous argument") {
            return Ok("".to_string());
        }
        return Err(format!("差分の取得に失敗しました。\n詳細: {}", stderr));
    }

    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(diff)
}

#[tauri::command]
pub async fn git_merge_to_main(path: String, branch: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    info!("本番（main）への採用を開始します: {} -> main", branch);

    // 1. mainブランチに切り替え
    let checkout_output = Command::new("git")
        .arg("checkout")
        .arg("main")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("mainブランチへの切り替えに失敗しました: {}", e))?;

    if !checkout_output.status.success() {
        let stderr = String::from_utf8_lossy(&checkout_output.stderr);
        return Err(format!("mainブランチへの切り替えに失敗しました。未保存の変更がないか確認してください。\n詳細: {}", stderr));
    }

    // 2. マージを実行
    let merge_output = Command::new("git")
        .arg("merge")
        .arg(&branch)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("マージの実行に失敗しました: {}", e))?;

    if merge_output.status.success() {
        Ok("本番への採用が完了しました。".to_string())
    } else {
        let stdout = String::from_utf8_lossy(&merge_output.stdout);
        let stderr = String::from_utf8_lossy(&merge_output.stderr);
        
        if stdout.contains("CONFLICT") || stderr.contains("CONFLICT") {
            // 競合が発生した場合はそのままの状態を維持し、フロントエンドに通知
            debug!("マージ競合を検知しました。解決が必要です。");
            Err("CONFLICT".to_string())
        } else {
            // その他のエラー時は安全のため元のブランチに戻すことを試みる
            let _ = Command::new("git")
                .arg("checkout")
                .arg(&branch)
                .current_dir(&repo_path)
                .status();
            Err(format!("マージ中に予期しないエラーが発生しました:\n{}", stderr))
        }
    }
}

#[tauri::command]
pub async fn git_get_conflicts(path: String) -> Result<Vec<String>, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|_| "error.failed_to_canonicalize_path".to_string())?;

    // 競合しているファイルの一覧を取得
    let output = Command::new("git")
        .arg("diff")
        .arg("--name-only")
        .arg("--diff-filter=U")
        .current_dir(&repo_path)
        .output()
        .map_err(|_| "conflict.error_loading".to_string())?;

    if !output.status.success() {
        return Err("conflict.error_loading".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files = stdout.lines().map(|s| s.to_string()).collect();
    Ok(files)
}

#[tauri::command]
pub async fn git_resolve_conflict(path: String, file: String, resolution: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|_| "error.failed_to_canonicalize_path".to_string())?;

    // Gitから引用符付きで返ってきた場合を考慮してトリム
    let safe_file = file.trim_matches('"');

    // mainブランチにいる状態で:
    // --ours   => mainの内容を採用
    // --theirs => マージしようとしているブランチ（お試しルート）の内容を採用
    let strategy = if resolution == "current" { "--theirs" } else { "--ours" };

    info!("競合を解決します: ファイル={}, 戦略={}", safe_file, strategy);

    // 1. 指定した内容でファイルを復元
    let checkout_status = Command::new("git")
        .arg("checkout")
        .arg(strategy)
        .arg(safe_file)
        .current_dir(&repo_path)
        .status()
        .map_err(|_| "conflict.error_resolving".to_string())?;

    if !checkout_status.success() {
        return Err("conflict.error_resolving".to_string());
    }

    // 2. 解決したファイルをインデックスに追加（競合解消の確定）
    let add_status = Command::new("git")
        .arg("add")
        .arg(safe_file)
        .current_dir(&repo_path)
        .status()
        .map_err(|_| "conflict.error_resolving".to_string())?;

    if !add_status.success() {
        return Err("conflict.error_resolving".to_string());
    }

    Ok("OK".to_string())
}

#[tauri::command]
pub async fn git_merge_abort(path: String, original_branch: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    info!("マージをアボートし、ブランチ '{}' に戻ります: {:?}", original_branch, repo_path);

    // 1. git merge --abort
    // マージ中でない場合でもエラーにならないよう、ステータスはチェックするが無視しても良い
    let _ = Command::new("git")
        .arg("merge")
        .arg("--abort")
        .current_dir(&repo_path)
        .status();

    // 2. 元のブランチにチェックアウト
    let checkout_output = Command::new("git")
        .arg("checkout")
        .arg(&original_branch)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("元のブランチへの復帰に失敗しました: {}", e))?;

    if !checkout_output.status.success() {
        let stderr = String::from_utf8_lossy(&checkout_output.stderr);
        return Err(format!("ブランチ '{}' への復帰に失敗しました。\n詳細: {}", original_branch, stderr));
    }

    Ok(format!("マージを中止し、'{}' に戻りました。", original_branch))
}

#[tauri::command]
pub async fn git_show_file_content(
    path: String,
    commit_hash: String,
    file_path: String,
) -> Result<FilePreviewContent, String> {
    let repo_path = dunce::canonicalize(Path::new(&path))
        .map_err(|e| format!("ルートパスの正規化に失敗したよ: {}", e))?;
    let file_abs_path = dunce::canonicalize(Path::new(&file_path))
        .map_err(|e| format!("ファイルパスの正規化に失敗したよ: {}", e))?;

    // 相対パスを取得（git showで使用する形式）
    let rel_path = file_abs_path
        .strip_prefix(&repo_path)
        .map_err(|_| "ファイルがプロジェクトルートの下にありません。".to_string())?
        .to_string_lossy()
        .replace('\\', "/");

    let show_arg = format!("{}:{}", commit_hash, rel_path);
    debug!("git show を実行します: {}", show_arg);

    // git show <commit_hash>:<relative_path>
    let output = Command::new("git")
        .arg("show")
        .arg(&show_arg)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git show の実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ファイルの取得に失敗しました。\n詳細: {}", stderr));
    }

    let extension = file_abs_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    parse_file_content_bytes(&output.stdout, &extension)
}

#[tauri::command]
pub async fn git_diff_file_commit(
    path: String,
    commit_hash: String,
    file_path: String,
) -> Result<String, String> {
    let repo_path = dunce::canonicalize(Path::new(&path))
        .map_err(|e| format!("ルートパスの正規化に失敗したよ: {}", e))?;
    let file_abs_path = dunce::canonicalize(Path::new(&file_path))
        .map_err(|e| format!("ファイルパスの正規化に失敗したよ: {}", e))?;

    // 相対パスを取得
    let rel_path = file_abs_path
        .strip_prefix(&repo_path)
        .map_err(|_| "ファイルがプロジェクトルートの下にありません。".to_string())?
        .to_string_lossy()
        .replace('\\', "/");

    // 親コミットとの差分：git diff <commit>^ <commit> -- <file>
    let parent_diff_arg = format!("{}^", commit_hash);
    debug!("git diff を実行します: {} {} -- {}", parent_diff_arg, commit_hash, rel_path);

    let output = Command::new("git")
        .arg("diff")
        .arg(&parent_diff_arg)
        .arg(&commit_hash)
        .arg("--")
        .arg(&rel_path)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git diff の実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // 最初（親がない）のコミットの場合は、空のツリーとの比較：git diff 4b825dc642cb6eb9a030e54d6911027b28c16a86 <commit> -- <file>
        // または `git show <commit> -- <file>` から差分を抽出する
        // ここではフォールバックとして、親がない場合は `git show` のパッチ形式で取得してみる
        let fallback_output = Command::new("git")
            .arg("show")
            .arg(&commit_hash)
            .arg("--")
            .arg(&rel_path)
            .current_dir(&repo_path)
            .output();

        if let Ok(fo) = fallback_output {
            if fo.status.success() {
                let stdout = String::from_utf8_lossy(&fo.stdout).to_string();
                return Ok(stdout);
            }
        }

        return Err(format!("差分の取得に失敗しました。\n詳細: {}", stderr));
    }

    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(diff)
}

#[tauri::command]
pub async fn git_delete_branch(path: String, branch_name: String) -> Result<String, String> {
    let raw_path = Path::new(&path);
    let repo_path = dunce::canonicalize(raw_path)
        .map_err(|e| format!("パスの正規化に失敗しました: {}", e))?;

    info!("ブランチ '{}' を削除します: {:?}", branch_name, repo_path);

    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("無効なディレクトリパスです。".to_string());
    }

    // カレントブランチを取得してチェック
    let current_branch = git_get_current_branch(path.clone()).await?;
    if current_branch == branch_name {
        return Err("現在使用中のルート（ブランチ）は削除できません。他のルートに切り替えてから削除してください。".to_string());
    }

    if branch_name == "main" {
        return Err("本番（main）ルートは削除できません。".to_string());
    }

    // git branch -D <branch_name>
    let output = Command::new("git")
        .arg("branch")
        .arg("-D")
        .arg(&branch_name)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git branch -D の実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ルート '{}' の削除に失敗しました。\n詳細: {}", branch_name, stderr));
    }

    Ok(format!("ルート '{}' を削除しました。", branch_name))
}

#[tauri::command]
pub async fn git_get_remote(path: String) -> Result<Option<String>, String> {
    let repo_path = dunce::canonicalize(Path::new(&path))
        .map_err(|e| format!("パスの正規化に失敗したよ: {}", e))?;

    let output = Command::new("git")
        .arg("remote")
        .arg("get-url")
        .arg("origin")
        .current_dir(&repo_path)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let url = String::from_utf8_lossy(&out.stdout).trim().to_string();
                Ok(Some(url))
            } else {
                Ok(None)
            }
        }
        Err(_) => Ok(None)
    }
}

#[tauri::command]
pub async fn git_set_remote(path: String, remote_url: String) -> Result<(), String> {
    let repo_path = dunce::canonicalize(Path::new(&path))
        .map_err(|e| format!("パスの正規化に失敗したよ: {}", e))?;

    // すでに origin があれば削除する（上書きするため）
    let _ = Command::new("git")
        .arg("remote")
        .arg("remove")
        .arg("origin")
        .current_dir(&repo_path)
        .status();

    let status = Command::new("git")
        .arg("remote")
        .arg("add")
        .arg("origin")
        .arg(&remote_url)
        .current_dir(&repo_path)
        .status()
        .map_err(|e| format!("git remote add に失敗したよ: {}", e))?;

    if !status.success() {
        return Err("リモートリポジトリの設定に失敗したよ。URLが正しいか確認してね。".to_string());
    }

    Ok(())
}

/// トークンを含めた認証付きの安全な一時URLを構築するヘルパー関数
fn build_auth_url(remote_url: &str, token: &str) -> Result<String, String> {
    if remote_url.starts_with("https://") {
        let stripped = remote_url.trim_start_matches("https://");
        Ok(format!("https://{}@{}", token, stripped))
    } else if remote_url.starts_with("http://") {
        let stripped = remote_url.trim_start_matches("http://");
        Ok(format!("http://{}@{}", token, stripped))
    } else {
        Ok(remote_url.to_string())
    }
}

#[tauri::command]
pub async fn git_push(path: String, token: String, branch: String) -> Result<String, String> {
    let repo_path = dunce::canonicalize(Path::new(&path))
        .map_err(|e| format!("パスの正規化に失敗したよ: {}", e))?;

    // 1. リモートURLを取得
    let remote_opt = git_get_remote(path.clone()).await?;
    let remote_url = match remote_opt {
        Some(url) => url,
        None => return Err("リモートリポジトリが設定されていないよ。まず紐付けを設定してね。".to_string())
    };

    // 2. 認証付きURLを生成
    let auth_url = build_auth_url(&remote_url, &token)?;

    info!("Git Pushを開始します: ブランチ={}, リモート={}", branch, remote_url);

    // 3. プッシュの実行（-u オプション付きで上流を設定）
    let output = Command::new("git")
        .arg("push")
        .arg("-u")
        .arg(&auth_url)
        .arg(&branch)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git pushの実行に失敗したよ: {}", e))?;

    if output.status.success() {
        info!("Git Pushが成功しました");
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        error!("Git Pushが失敗しました: {}", stderr);
        // セキュリティのためエラーログ内の生トークンをマスクする
        let masked_error = stderr.replace(&token, "******");
        Err(format!("クラウドへの送信（Push）に失敗したよ。\n詳細: {}", masked_error))
    }
}

#[tauri::command]
pub async fn git_pull(path: String, token: String, branch: String) -> Result<String, String> {
    let repo_path = dunce::canonicalize(Path::new(&path))
        .map_err(|e| format!("パスの正規化に失敗したよ: {}", e))?;

    // 1. リモートURLを取得
    let remote_opt = git_get_remote(path.clone()).await?;
    let remote_url = match remote_opt {
        Some(url) => url,
        None => return Err("リモートリポジトリが設定されていないよ。まず紐付けを設定してね。".to_string())
    };

    // 2. 認証付きURLを生成
    let auth_url = build_auth_url(&remote_url, &token)?;

    info!("Git Pullを開始します: ブランチ={}, リモート={}", branch, remote_url);

    // 3. プルの実行
    let output = Command::new("git")
        .arg("pull")
        .arg(&auth_url)
        .arg(&branch)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("git pullの実行に失敗したよ: {}", e))?;

    if output.status.success() {
        info!("Git Pullが成功しました");
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        error!("Git Pullが失敗しました: {}", stderr);

        // 競合が発生した場合の判定
        if stderr.contains("CONFLICT") || stdout.contains("CONFLICT") {
            debug!("プル中にマージ競合を検知しました。");
            return Err("CONFLICT".to_string());
        }

        // セキュリティのためエラーログ内の生トークンをマスクする
        let masked_error = stderr.replace(&token, "******");
        Err(format!("クラウドからの受信（Pull）に失敗したよ。\n詳細: {}", masked_error))
    }
}


