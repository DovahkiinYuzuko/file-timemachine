import { type FC, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
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

type FileType = "image" | "video" | "audio" | "text" | "unknown";

/**
 * Accessibility Strategy:
 * - Use <article> to encapsulate the preview content.
 * - Media elements (<img>, <video>, <audio>) use convertFileSrc for direct streaming.
 * - <video> and <audio> include "controls" for keyboard accessibility.
 * - Text previews use <pre> with aria-readonly="true".
 * - Loading and error states are communicated via aria-live regions or roles.
 */

const FilePreview: FC<FilePreviewProps> = ({ filePath }) => {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine file type from extension
  const fileType = useMemo((): FileType => {
    if (!filePath) return "unknown";
    const ext = filePath.split(".").pop()?.toLowerCase();
    
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext || "")) return "image";
    if (["mp4", "webm"].includes(ext || "")) return "video";
    if (["mp3", "m4a", "wav", "ogg"].includes(ext || "")) return "audio";
    
    return "text";
  }, [filePath]);

  useEffect(() => {
    if (!filePath || fileType !== "text") {
      setTextContent(null);
      setError(null);
      return;
    }

    const fetchTextContent = async () => {
      setLoading(true);
      setError(null);
      logger.info(`Starting to fetch text content for: ${filePath}`);
      try {
        const result = await invoke<PreviewContent>("read_file_content", { path: filePath });
        setTextContent(result.content);
        logger.debug("Successfully loaded text content");
      } catch (err) {
        logger.error(`Failed to read file: ${err}`);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchTextContent();
  }, [filePath, fileType]);

  if (!filePath) {
    return (
      <div className="preview-empty" role="status">
        <p>{t("common.placeholder.select_file_to_preview")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="preview-loading" role="status">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview-error" role="alert">
        <p>Error: {error}</p>
      </div>
    );
  }

  const assetUrl = filePath ? convertFileSrc(filePath) : "";

  return (
    <article className="file-preview-container" aria-label={t("common.aria.file_preview", { path: filePath })}>
      <header className="preview-info">
        <h3>{filePath}</h3>
      </header>
      
      <div className="preview-body">
        {fileType === "image" && (
          <div className="image-preview">
            <img 
              src={assetUrl} 
              alt={t("common.aria.preview_of", { path: filePath })} 
            />
          </div>
        )}

        {fileType === "video" && (
          <div className="video-preview">
            <video 
              controls 
              src={assetUrl} 
              aria-label={t("common.aria.preview_of", { path: filePath })}
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
              aria-label={t("common.aria.preview_of", { path: filePath })}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {fileType === "text" && (
          <pre className="text-preview" aria-readonly="true">
            <code>{textContent}</code>
          </pre>
        )}
      </div>
    </article>
  );
};

export default FilePreview;
