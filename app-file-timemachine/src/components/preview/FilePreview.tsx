import { type FC, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Info, Loader2, FileText, AlertCircle, FileQuestion } from "lucide-react";
import logger from "../../utils/logger";
import "./FilePreview.css";

interface FilePreviewProps {
  filePath: string | null;
}

interface PreviewContent {
  content: string;
  is_image: boolean;
  mime_type: string;
}

interface FileMetadata {
  name: string;
  size: number;
  modified: string;
}

type FileType = "image" | "video" | "audio" | "text" | "unknown";

/**
 * Accessibility Strategy:
 * - Use <article> to encapsulate the preview content.
 * - Media elements (<img>, <video>, <audio>) use convertFileSrc for direct streaming.
 * - <video> and <audio> include "controls" for keyboard accessibility.
 * - Text previews use <pre> with aria-readonly="true" for screen readers.
 * - Fallback "Information Card" provides textual details for binary/unsupported files.
 * - Loading and error states are communicated via aria-live regions or roles.
 * - Contrast ratios adhere to WCAG 2.2 AA (Design System compliant).
 */

const FilePreview: FC<FilePreviewProps> = ({ filePath }) => {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine file type from extension
  const fileType = useMemo((): FileType => {
    if (!filePath) return "unknown";
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "image";
    if (["mp4", "webm"].includes(ext)) return "video";
    if (["mp3", "m4a", "wav", "ogg"].includes(ext)) return "audio";
    if (["txt", "md", "json", "js", "ts", "tsx", "css", "html", "rs", "py", "go", "c", "cpp", "h", "java", "sh", "yml", "yaml", "toml", "env"].includes(ext)) return "text";
    
    return "unknown";
  }, [filePath]);

  useEffect(() => {
    if (!filePath) {
      setTextContent(null);
      setMetadata(null);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Always fetch metadata for headers and fallback info
        const meta = await invoke<FileMetadata>("get_file_info", { path: filePath });
        setMetadata(meta);

        if (fileType === "text") {
          logger.info(`Fetching text content for: ${filePath}`);
          const result = await invoke<PreviewContent>("read_file_content", { path: filePath });
          setTextContent(result.content);
        } else {
          setTextContent(null);
        }
      } catch (err) {
        logger.error(`Failed to load file data: ${err}`);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filePath, fileType]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!filePath) {
    return (
      <div className="preview-empty" role="status">
        <FileQuestion size={48} strokeWidth={1.5} />
        <p>{t("common.placeholder.select_file_to_preview")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="preview-loading" role="status" aria-busy="true">
        <Loader2 className="loader-spinner" size={48} />
        <p>{t("common.loading") || "Loading..."}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview-error" role="alert">
        <AlertCircle size={48} />
        <p>Error: {error}</p>
      </div>
    );
  }

  const assetUrl = filePath ? convertFileSrc(filePath) : "";

  return (
    <article className="file-preview-container" aria-label={t("common.aria.file_preview", { path: metadata?.name || filePath })}>
      <header className="preview-info">
        <FileText size={16} />
        <h3>{metadata?.name || filePath}</h3>
      </header>
      
      <div className="preview-body">
        {fileType === "image" && (
          <div className="image-preview">
            <img 
              src={assetUrl} 
              alt={t("common.aria.preview_of", { path: metadata?.name || filePath })} 
            />
          </div>
        )}

        {fileType === "video" && (
          <div className="video-preview">
            <video 
              controls 
              src={assetUrl} 
              aria-label={t("common.aria.preview_of", { path: metadata?.name || filePath })}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {fileType === "audio" && (
          <div className="audio-preview">
            <audio 
              controls 
              src={assetUrl} 
              aria-label={t("common.aria.preview_of", { path: metadata?.name || filePath })}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {fileType === "text" && textContent !== null && (
          <pre className="text-preview" aria-readonly="true">
            <code>{textContent}</code>
          </pre>
        )}

        {fileType === "unknown" && metadata && (
          <div className="info-card">
            <div className="info-icon-wrapper">
              <Info size={40} />
            </div>
            <div className="info-content">
              <h2>{t("preview.unknown_type.title") || "バイナリファイル"}</h2>
              <p className="info-message">
                {t("preview.unknown_type.message") || "このファイル形式のプレビューはサポートされていませんが、大切なデータとして管理されています。"}
              </p>
              
              <div className="info-details">
                <span className="detail-label">{t("common.file_name") || "ファイル名"}:</span>
                <span className="detail-value">{metadata.name}</span>
                
                <span className="detail-label">{t("common.file_size") || "サイズ"}:</span>
                <span className="detail-value">{formatSize(metadata.size)}</span>
                
                <span className="detail-label">{t("common.last_modified") || "最終更新"}:</span>
                <span className="detail-value">{metadata.modified}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default FilePreview;
