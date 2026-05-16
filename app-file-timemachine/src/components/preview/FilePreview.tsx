import { type FC } from "react";
import { useTranslation } from "react-i18next";
import "./FilePreview.css";

interface FilePreviewProps {
  filePath?: string;
  fileType?: "text" | "image" | "binary";
  content?: string;
  imageUrl?: string;
}

/**
 * Accessibility Strategy:
 * - Use <article> to encapsulate the preview content.
 * - Text previews use <pre> with aria-readonly="true" for clear structure.
 * - Image previews have descriptive alt text (or filename if unavailable).
 * - Empty states are clearly labeled for screen readers.
 */

const FilePreview: FC<FilePreviewProps> = ({ filePath, fileType, content, imageUrl }) => {
  const { t } = useTranslation();

  if (!filePath) {
    return (
      <div className="preview-empty" role="status">
        <p>{t("common.placeholder.select_file_to_preview")}</p>
      </div>
    );
  }

  return (
    <article className="file-preview-container" aria-label={t("common.aria.file_preview", { path: filePath })}>
      <header className="preview-info">
        <h3>{filePath}</h3>
      </header>
      
      <div className="preview-body">
        {fileType === "text" && (
          <pre className="text-preview" aria-readonly="true">
            <code>{content}</code>
          </pre>
        )}

        {fileType === "image" && imageUrl && (
          <div className="image-preview">
            <img src={imageUrl} alt={t("common.aria.preview_of", { path: filePath })} />
          </div>
        )}

        {fileType === "binary" && (
          <div className="binary-preview">
            <p>{t("common.placeholder.binary_file_preview_not_supported")}</p>
          </div>
        )}

        {!fileType && (
          <div className="unknown-preview">
            <p>{t("common.placeholder.unknown_file_type")}</p>
          </div>
        )}
      </div>
    </article>
  );
};

export default FilePreview;
