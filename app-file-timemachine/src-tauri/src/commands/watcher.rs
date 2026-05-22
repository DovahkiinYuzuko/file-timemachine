use std::sync::Mutex;
use std::path::Path;
use notify::{Watcher, RecommendedWatcher, RecursiveMode};
use tauri::{AppHandle, State, Emitter};
use log::{info, error};

pub struct WatcherState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(serde::Serialize, Clone)]
struct FileChangeEventPayload {
    paths: Vec<String>,
}

#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    state: State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    info!("Starting file watcher for path: {}", path);

    // 既存の監視をドロップ（ドロップされると自動的に監視が停止する）
    {
        let mut watcher_lock = state.watcher.lock().map_err(|e| {
            error!("Failed to lock watcher state: {}", e);
            "Failed to lock watcher state".to_string()
        })?;
        *watcher_lock = None;
    }

    let target_path = Path::new(&path);
    if !target_path.exists() {
        error!("Target path does not exist: {}", path);
        return Err("Target path does not exist".to_string());
    }

    let app_handle_clone = app.clone();
    let path_str = path.clone();

    // 監視イベントハンドラーの定義
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            match res {
                Ok(event) => {
                    // 無視対象ディレクトリ（.gitやnode_modules）のフィルタリング
                    let has_valid_changes = event.paths.iter().any(|p| {
                        let p_str = p.to_string_lossy();
                        // .git や node_modules を含むパスは無視する
                        !p_str.contains(".git") && !p_str.contains("node_modules")
                    });

                    if has_valid_changes {
                        let changed_paths: Vec<String> = event
                            .paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();

                        info!("File change detected in watch path {}: {:?}", path_str, changed_paths);

                        // フロントエンドに通知
                        let payload = FileChangeEventPayload {
                            paths: changed_paths,
                        };
                        if let Err(e) = app_handle_clone.emit("file-system-change", payload) {
                            error!("Failed to emit file-system-change event: {}", e);
                        }
                    }
                }
                Err(e) => {
                    error!("Watcher error: {}", e);
                }
            }
        },
        notify::Config::default(),
    ).map_err(|e| {
        error!("Failed to create recommended watcher: {}", e);
        format!("Failed to create recommended watcher: {}", e)
    })?;

    // 再帰的に監視を開始
    watcher.watch(target_path, RecursiveMode::Recursive).map_err(|e| {
        error!("Failed to start watching: {}", e);
        format!("Failed to start watching: {}", e)
    })?;

    // 作成したウォッチャーを状態に保存
    {
        let mut watcher_lock = state.watcher.lock().map_err(|e| {
            error!("Failed to lock watcher state for saving: {}", e);
            "Failed to lock watcher state for saving".to_string()
        })?;
        *watcher_lock = Some(watcher);
    }

    info!("Successfully started watching for path: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn stop_watching(
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    info!("Stopping file watcher");

    let mut watcher_lock = state.watcher.lock().map_err(|e| {
        error!("Failed to lock watcher state: {}", e);
        "Failed to lock watcher state".to_string()
    })?;

    // ドロップして監視を終了
    *watcher_lock = None;

    info!("Successfully stopped file watcher");
    Ok(())
}
