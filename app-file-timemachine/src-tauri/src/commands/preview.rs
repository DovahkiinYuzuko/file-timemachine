use std::fs;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};
use serde::Serialize;
use tauri::command;

#[derive(Serialize)]
pub struct FilePreviewContent {
    pub content: String,
    pub is_image: bool,
    pub mime_type: String,
}

#[command]
pub async fn read_file_content(path: String) -> Result<FilePreviewContent, String> {
    log::info!("Reading file content for preview: {}", path);
    
    let path_buf = dunce::canonicalize(&path).map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    
    let metadata = fs::metadata(&path_buf).map_err(|e| format!("Failed to get metadata: {}", e))?;
    let file_size = metadata.len();
    
    // 5MB limit
    if file_size > 5 * 1024 * 1024 {
        return Err("File is too large (max 5MB)".to_string());
    }

    let extension = path_buf.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    let is_image = matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp");
    
    if is_image {
        let bytes = fs::read(&path_buf).map_err(|e| format!("Failed to read image file: {}", e))?;
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
            mime_type: mime_type.to_string(),
        })
    } else {
        let content = fs::read_to_string(&path_buf).map_err(|e| format!("Failed to read text file: {}", e))?;
        Ok(FilePreviewContent {
            content,
            is_image: false,
            mime_type: "text/plain".to_string(),
        })
    }
}
