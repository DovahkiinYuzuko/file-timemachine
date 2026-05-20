use serde::Serialize;
use walkdir::WalkDir;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::io::{Write, Read};
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_ignored: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn get_file_tree(root_path: String) -> Result<Vec<FileEntry>, String> {
    let root = dunce::canonicalize(&root_path)
        .map_err(|e| format!("パスが正しくないよ: {}", e))?;
    let root_str = root.to_string_lossy().into_owned();

    log::info!("ファイルツリーの探索を開始するよ。対象: {:?}", root);

    // walkdirを使ってフラットなリストを取得
    // .git, node_modules, target フォルダはスキップするよ
    let mut entries = Vec::new();
    let walker = WalkDir::new(&root)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let file_name = e.file_name().to_string_lossy();
            file_name != ".git" && file_name != "node_modules" && file_name != "target"
        });

    let mut paths_to_check = Vec::new();

    for entry in walker {
        let entry = entry.map_err(|e| format!("ファイルが見つからないよ: {}", e))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| format!("メタデータが取れないよ: {}", e))?;

        let path_str = path.to_string_lossy().into_owned();
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
        let mut child = Command::new("git")
            .args(["check-ignore", "--stdin", "--no-index"])
            .current_dir(&root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|e| format!("git check-ignoreの起動に失敗したよ: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            for path in &paths_to_check {
                let rel_path = path.strip_prefix(&root_str).unwrap_or(path).trim_start_matches(|c| c == '\\' || c == '/');
                // Windowsのバックスラッシュをスラッシュに正規化してから渡す
                let rel_path_normalized = rel_path.replace('\\', "/");
                writeln!(stdin, "{}", rel_path_normalized).map_err(|e| format!("stdinへの書き込みに失敗したよ: {}", e))?;
            }
        }

        let output = child.wait_with_output().map_err(|e| format!("git check-ignoreの待機に失敗したよ: {}", e))?;   
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.lines().map(|s| s.to_string()).collect::<Vec<String>>()
    } else {
        Vec::new()
    };

    let ignored_set: std::collections::HashSet<String> = ignored_paths.into_iter().collect();

    log::info!("全部で {} 件のアイテムを見つけたよ！ツリー形式に組み立てるね。", entries.len());      

    let mut entry_map: HashMap<PathBuf, FileEntry> = entries.into_iter().map(|(p, mut e)| {
        let rel_path = e.path.strip_prefix(&root_str).unwrap_or(&e.path).trim_start_matches(|c| c == '\\' || c == '/');    
        let normalized_rel_path = rel_path.replace('\\', "/");
        if ignored_set.contains(&normalized_rel_path) {
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
