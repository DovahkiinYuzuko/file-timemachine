use serde::Serialize;
use walkdir::WalkDir;
use std::collections::HashMap;

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
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
            file_name != ".git"
        });

    for entry in walker {
        let entry = entry.map_err(|e| format!("ファイルが見つからないよ: {}", e))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| format!("メタデータが取れないよ: {}", e))?;

        entries.push((
            path.to_path_buf(),
            FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: path.to_string_lossy().into_owned(),
                is_dir: metadata.is_dir(),
                children: if metadata.is_dir() { Some(Vec::new()) } else { None },
            },
        ));
    }

    log::info!("全部で {} 件のアイテムを見つけたよ！ツリー形式に組み立てるね。", entries.len());

    // フラットなリストを階層構造に組み立てる
    let mut entry_map: HashMap<std::path::PathBuf, FileEntry> = entries.into_iter().collect();
    let mut root_entries = Vec::new();

    // パスの長さでソートして、深いところから親に追加していくか、
    // あるいは単純に全エントリをループして親を探す。
    // ここでは、全パスを調べて親が map にあればそこに追加、なければ root_entries に追加するよ。
    let keys: Vec<_> = entry_map.keys().cloned().collect();
    
    // パスの深さ順（長い順）に処理すると、子を親に詰めるのが楽
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
