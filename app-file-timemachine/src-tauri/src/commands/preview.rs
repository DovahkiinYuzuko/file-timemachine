use std::fs;
use base64::{Engine as _, engine::general_purpose};
use serde::Serialize;
use tauri::command;

#[derive(Serialize)]
pub struct FilePreviewContent {
    pub content: String,
    pub is_image: bool,
    pub is_binary: bool,
    pub mime_type: String,
}

#[command]
pub async fn read_file_content(path: String) -> Result<FilePreviewContent, String> {
    log::info!("Reading file content for preview: {}", path);

    // パスの正規化
    let path_buf = dunce::canonicalize(&path)
        .map_err(|_| "error.failed_to_canonicalize_path".to_string())?;

    let metadata = fs::metadata(&path_buf)
        .map_err(|_| "error.failed_to_get_metadata".to_string())?;
    let file_size = metadata.len();

    // 5MB limit
    if file_size > 5 * 1024 * 1024 {
        return Err("common.placeholder.file_too_large".to_string());
    }

    let extension = path_buf.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    let is_image = matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp");

    if is_image {
        let bytes = fs::read(&path_buf)
            .map_err(|_| "error.failed_to_read_image".to_string())?;
        let b64 = general_purpose::STANDARD.encode(bytes);
        let mime_type = match extension.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            _ => "image/png",
        };

        Ok(FilePreviewContent {
            content: b64,
            is_image: true,
            is_binary: true,
            mime_type: mime_type.to_string(),
        })
    } else {
        let bytes = fs::read(&path_buf)
            .map_err(|_| "error.failed_to_read_file".to_string())?;

        // バイナリ検出（nullバイトチェック）
        let is_binary = bytes.iter().take(1024).any(|&b| b == 0);

        if is_binary {
            Ok(FilePreviewContent {
                content: String::new(),
                is_image: false,
                is_binary: true,
                mime_type: "application/octet-stream".to_string(),
            })
        } else {
            // テキストファイルとしてデコード
            let mut detector = chardetng::EncodingDetector::new();
            detector.feed(&bytes, true);
            let encoding = detector.guess(None, true);
            let (content, _, _) = encoding.decode(&bytes);

            Ok(FilePreviewContent {
                content: content.into_owned(),
                is_image: false,
                is_binary: false,
                mime_type: "text/plain".to_string(),
            })
        }
    }
}

