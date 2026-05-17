use serde::Serialize;
use walkdir::WalkDir;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::io::Write;

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

    log::info!("ファイルツリーの探索を開始するね！対象: {:?}", root);

    // walkdirを使ってフラットなリストを取得
    // .gitフォルダはスキップするよ
    let mut entries = Vec::new();
    let walker = WalkDir::new(&root)
        .min_depth(1) // ルート自体は含めない
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
                is_ignored: false, // 後で更新するよ
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
                // 相対パスにして渡す
                let rel_path = path.strip_prefix(&root_path).unwrap_or(path).trim_start_matches(|c| c == '\\' || c == '/');
                writeln!(stdin, "{}", rel_path).map_err(|e| format!("stdinへの書き込みに失敗したよ: {}", e))?;
            }
        }

        let output = child.wait_with_output().map_err(|e| format!("git check-ignoreの待機に失敗したよ: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.lines().map(|s| s.to_string()).collect::<Vec<String>>()
    } else {
        Vec::new()
    };

    // 無視されているパスをセットに変換して高速に検索できるようにする
    let ignored_set: std::collections::HashSet<String> = ignored_paths.into_iter().collect();

    log::info!("全部で {} 件のアイテムを見つけたよ！ツリー形式に組み立てるね。", entries.len());

    // フラットなリストを階層構造に組み立てる
    let mut entry_map: HashMap<std::path::PathBuf, FileEntry> = entries.into_iter().map(|(p, mut e)| {
        let rel_path = e.path.strip_prefix(&root_path).unwrap_or(&e.path).trim_start_matches(|c| c == '\\' || c == '/');
        // git check-ignoreの結果はスラッシュ区切りなので置換して比較
        let normalized_rel_path = rel_path.replace('\\', "/");
        if ignored_set.contains(&normalized_rel_path) {
            e.is_ignored = true;
        }
        (p, e)
    }).collect();
    
    let mut root_entries = Vec::new();

    // パスの長さでソートして、深いところから親に追加していく
    let keys: Vec<_> = entry_map.keys().cloned().collect();
    let mut sorted_keys = keys;
    sorted_keys.sort_by_key(|a| std::cmp::Reverse(a.components().count()));

    for path in sorted_keys {
        if let Some(mut entry) = entry_map.remove(&path) {
            // ディレクトリの場合は子要素を名前順にソート（ディレクトリ優先）
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
            // 親がいない（またはルート直下）場合はルートエントリに追加
            root_entries.push(entry);
        }
    }

    // ルートエントリもソートしておくよ
    root_entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name))
    });

    log::debug!("ツリーの組み立てが終わったよ！");
    Ok(root_entries)
}
