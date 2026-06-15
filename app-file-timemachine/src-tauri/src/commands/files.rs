use serde::Serialize;
use walkdir::WalkDir;
use std::collections::HashMap;
use std::process::Stdio;
use crate::SafeCommand as Command;
use std::io::{Write, Read};
use std::path::PathBuf;

/// git check-ignore の出力行をパースして実際のパス文字列に変換する。
/// git は非ASCII文字を含むパスをダブルクォートで囲んでオクタルエスケープ形式で出力する。
/// 例: "\343\203\217\343\203\252\343\203\234\343\203\206\343\203\252\343\202\271\343\203\210.md"
///     → "ハリボテリスト.md"
fn parse_git_ignore_output_line(line: &str) -> String {
    let trimmed = line.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        let inner = &trimmed[1..trimmed.len() - 1];
        unescape_git_path(inner)
    } else {
        trimmed.to_string()
    }
}

/// git のオクタルエスケープシーケンス（\NNN形式）をUTF-8文字列に変換するヘルパー。
fn unescape_git_path(s: &str) -> String {
    let mut bytes: Vec<u8> = Vec::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' && i + 3 < chars.len() {
            let octal: String = chars[i + 1..=i + 3].iter().collect();
            if let Ok(byte_val) = u8::from_str_radix(&octal, 8) {
                bytes.push(byte_val);
                i += 4;
                continue;
            }
        }
        // 通常の文字はそのままバイト列に変換
        let mut buf = [0u8; 4];
        let encoded = chars[i].encode_utf8(&mut buf);
        bytes.extend_from_slice(encoded.as_bytes());
        i += 1;
    }
    String::from_utf8(bytes).unwrap_or_else(|_| s.to_string())
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_ignored: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub async fn get_file_tree(root_path: String) -> Result<Vec<FileEntry>, String> {
    let root = dunce::canonicalize(&root_path)
        .map_err(|e| format!("パスが正しくないよ: {}", e))?;
    let root_str = root.to_string_lossy().into_owned();

    log::info!("ファイルツリーの探索を開始するよ。対象: {:?}", root);

    // git status --ignored --porcelain=v1 の出力を解析して、無視されているディレクトリを取得するよ
    let status_output = crate::SafeTokioCommand::new("git")
        .args(["status", "--ignored", "--porcelain=v1"])
        .current_dir(&root)
        .output()
        .await;

    let mut ignored_dirs = std::collections::HashSet::new();
    if let Ok(out) = status_output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        for line in stdout.lines() {
            if line.starts_with("!! ") {
                let rel_path = &line[3..];
                let parsed_path = parse_git_ignore_output_line(rel_path);
                if parsed_path.ends_with('/') {
                    ignored_dirs.insert(parsed_path);
                }
            }
        }
    }

    log::info!("無視されているディレクトリ数: {}", ignored_dirs.len());

    // walkdirを使ってフラットなリストを取得
    // .git フォルダ自身は絶対に走査・追加してはいけない（メタフォルダ）
    let mut entries = Vec::new();
    let mut paths_to_check = Vec::new();
    let mut it = WalkDir::new(&root)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let file_name = e.file_name().to_string_lossy();
            file_name != ".git"
        });

    loop {
        let entry = match it.next() {
            None => break,
            Some(Err(err)) => return Err(format!("ファイルが見つからないよ: {}", err)),
            Some(Ok(entry)) => entry,
        };

        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| format!("メタデータが取れないよ: {}", e))?;
        let path_str = path.to_string_lossy().into_owned();

        let rel_path = path.strip_prefix(&root).unwrap_or(path).to_string_lossy().into_owned();
        let rel_path_normalized = rel_path.replace('\\', "/");
        let rel_path_dir = if metadata.is_dir() {
            format!("{}/", rel_path_normalized)
        } else {
            rel_path_normalized.clone()
        };

        // もし現在のディレクトリが無視リストに含まれているなら、配下の走査をスキップする！
        if metadata.is_dir() && ignored_dirs.contains(&rel_path_dir) {
            log::info!("無視されたフォルダの配下走査をスキップするよ: {:?}", rel_path_dir);
            it.skip_current_dir();
        }

        paths_to_check.push(path_str.clone());

        entries.push((
            path.to_path_buf(),
            FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: path_str,
                is_dir: metadata.is_dir(),
                is_ignored: false,
                children: if metadata.is_dir() { Some(Vec::new()) } else { None },
            },
        ));
    }

    // git check-ignore を使って一括で無視状態を確認するよ
    let ignored_paths = if !paths_to_check.is_empty() {
        let mut child = crate::SafeTokioCommand::new("git")
            .args(["check-ignore", "--stdin", "--no-index"])
            .current_dir(&root)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("git check-ignoreの起動に失敗したよ: {}", e))?;

        let mut stdin = child.stdin.take().ok_or("stdinの取得に失敗したよ")?;
        let stdout = child.stdout.take().ok_or("stdoutの取得に失敗したよ")?;

        let paths_clone = paths_to_check.clone();
        let root_str_clone = root_str.clone();

        // stdinへの書き込みを非同期タスクとして実行し、書き込み完了後に stdin をクローズ (drop) する
        let write_task = tokio::spawn(async move {
            use tokio::io::AsyncWriteExt;
            for path in paths_clone {
                let rel_path = path.strip_prefix(&root_str_clone).unwrap_or(&path).trim_start_matches(['\\', '/']);
                let rel_path_normalized = rel_path.replace('\\', "/");
                log::debug!("[check-ignore stdin] 送信パス: {:?}", rel_path_normalized);
                if let Err(e) = writeln!(stdin, "{}", rel_path_normalized) {
                    log::error!("stdinへの書き込みに失敗したよ: {}", e);
                    break;
                }
            }
        });

        // stdoutの読み込み
        let read_task = tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stdout);
            let mut lines = Vec::new();
            let mut line = String::new();
            while let Ok(n) = reader.read_line(&mut line) {
                if n == 0 {
                    break;
                }
                lines.push(parse_git_ignore_output_line(&line));
                line.clear();
            }
            lines
        });

        // 両方の完了を待つ
        let _ = write_task.await;
        let lines = read_task.await.map_err(|e| format!("読み取りタスクの実行に失敗したよ: {}", e))?;
        let _ = child.wait().await;
        lines
    } else {
        Vec::new()
    };

    log::debug!("[check-ignore] ignored_paths 件数: {}", ignored_paths.len());
    for p in &ignored_paths {
        log::debug!("[check-ignore] ignored: {:?}", p);
    }

    let ignored_set: std::collections::HashSet<String> = ignored_paths.into_iter().collect();

    log::info!("全部で {} 件のアイテムを見つけたよ！ツリー形式に組み立てるね。", entries.len());      

    let mut entry_map: HashMap<PathBuf, FileEntry> = entries.into_iter().map(|(p, mut e)| {
        let rel_path = e.path.strip_prefix(&root_str).unwrap_or(&e.path).trim_start_matches(['\\', '/']);    
        let normalized_rel_path = rel_path.replace('\\', "/");
        let matched = ignored_set.contains(&normalized_rel_path);
        log::debug!(
            "[is_ignored] {:?} → normalized: {:?} → matched: {}",
            e.path, normalized_rel_path, matched
        );
        if matched {
            e.is_ignored = true;
        }
        (p, e)
    }).collect();

    let mut root_entries = Vec::new();
    let keys: Vec<_> = entry_map.keys().cloned().collect();
    let mut sorted_keys = keys;
    sorted_keys.sort_by_key(|a| std::cmp::Reverse(a.components().count()));

    for path in sorted_keys {
        if let Some(mut entry) = entry_map.remove(&path) {
            if let Some(ref mut children) = entry.children {
                children.sort_by(|a, b| {
                    b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name))
                });
            }

            if let Some(parent_path) = path.parent() {
                if let Some(parent_entry) = entry_map.get_mut(parent_path) {
                    if let Some(ref mut children) = parent_entry.children {
                        children.push(entry);
                        continue;
                    }
                }
            }
            root_entries.push(entry);
        }
    }

    root_entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name))
    });

    log::debug!("ツリーの組み立てが終わったよ！");
    Ok(root_entries)
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub modified: String,
    pub file_type: String, // "text", "image", "video", "audio", or "unknown"
    pub mime_type: String,
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let raw_path = std::path::Path::new(&path);
    let path_buf = dunce::canonicalize(raw_path).map_err(|e| format!("パスが正しくないよ: {}", e))?;
    
    log::info!("ファイル情報の取得を開始するよ。対象: {:?}", path_buf);

    let metadata = std::fs::metadata(&path_buf).map_err(|e| format!("メタデータが取れないよ: {}", e))?;

    let modified = metadata.modified()
        .map(|t| {
            let datetime: chrono::DateTime<chrono::Local> = t.into();
            datetime.format("%Y-%m-%d %H:%M:%S").to_string()
        })
        .unwrap_or_else(|_| "不明".to_string());

    let mut file_type = "unknown".to_string();
    let mut mime_type = "application/octet-stream".to_string();

    if metadata.is_file() {
        let mut file = std::fs::File::open(&path_buf).map_err(|e| format!("ファイルが開けないよ: {}", e))?;
        let mut buffer = [0; 8192];
        let n = file.read(&mut buffer).unwrap_or(0);
        let buffer = &buffer[..n];

        if let Some(kind) = infer::get(buffer) {
            mime_type = kind.mime_type().to_string();
            file_type = match kind.matcher_type() {
                infer::MatcherType::Image => "image".to_string(),
                infer::MatcherType::Video => "video".to_string(),
                infer::MatcherType::Audio => "audio".to_string(),
                _ => {
                    if mime_type.starts_with("text/") {
                        "text".to_string()
                    } else {
                        "unknown".to_string()
                    }
                }
            };
        } else {
            // inferで分からない場合は content_inspector でテキストか判定
            if content_inspector::inspect(buffer).is_text() {
                file_type = "text".to_string();
                mime_type = "text/plain".to_string();
            }
        }
    }

    Ok(FileInfo {
        name: path_buf.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        size: metadata.len(),
        modified,
        file_type,
        mime_type,
    })
}
