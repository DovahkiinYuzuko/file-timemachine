import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
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

/**
 * Accessibility Strategy:
 * - Use <article> to encapsulate the preview content.
 * - Text previews use <pre> with aria-readonly="true" for clear structure.
 * - Image previews have descriptive alt text with data URI.
 * - Loading and error states are clearly communicated.
 * - Empty states are clearly labeled for screen readers.
 */

const FilePreview: FC<FilePreviewProps> = ({ filePath }) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<PreviewContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setPreview(null);
      setError(null);
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      logger.info(`Starting to fetch content for: ${filePath}`);
      try {
        const result = await invoke<PreviewContent>("read_file_content", { path: filePath });
        setPreview(result);
        logger.debug("Successfully loaded preview content");
      } catch (err) {
        logger.error(`Failed to read file: ${err}`);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [filePath]);

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

  return (
    <article className="file-preview-container" aria-label={t("common.aria.file_preview", { path: filePath })}>
      <header className="preview-info">
        <h3>{filePath}</h3>
      </header>
      
      <div className="preview-body">
        {preview?.is_image ? (
          <div className="image-preview">
            <img 
              src={`data:${preview.mime_type};base64,${preview.content}`} 
              alt={t("common.aria.preview_of", { path: filePath })} 
            />
          </div>
        ) : (
          <pre className="text-preview" aria-readonly="true">
            <code>{preview?.content}</code>
          </pre>
        )}
      </div>
    </article>
  );
};

export default FilePreview;
