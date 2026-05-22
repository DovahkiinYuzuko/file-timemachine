import { type FC, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Info, Loader2, FileText, AlertCircle, FileQuestion } from "lucide-react";
import logger from "../../utils/logger";
import "./FilePreview.css";

interface FilePreviewProps {
  filePath: string | null;
  projectPath: string | null;
  selectedCommitHash: string | null;
  onClearCommitSelect: () => void;
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
  file_type: string;
  mime_type: string;
}

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

const FilePreview: FC<FilePreviewProps> = ({ filePath, projectPath, selectedCommitHash, onClearCommitSelect }) => {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const lastModifiedRef = useRef<string | null>(null);

  // ファイルまたはコミットが切り替わったらDiffをリセット
  useEffect(() => {
    setShowDiff(false);
    setDiffContent(null);
  }, [filePath, selectedCommitHash]);

  // Diffトグル時に差分を取得
  useEffect(() => {
    if (showDiff && filePath) {
      const fetchDiff = async () => {
        try {
          if (selectedCommitHash && projectPath) {
            logger.info(`Fetching diff for past commit [${selectedCommitHash}]: ${filePath}`);
            const diff = await invoke<string>("git_diff_file_commit", {
              path: projectPath,
              commitHash: selectedCommitHash,
              filePath: filePath,
            });
            setDiffContent(diff);
          } else {
            const diff = await invoke<string>("git_diff_file", { path: filePath });
            setDiffContent(diff);
          }
        } catch (err) {
          logger.error(`Failed to load diff: ${err}`);
        }
      };
      fetchDiff();
    }
  }, [showDiff, filePath, selectedCommitHash, projectPath]);

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
        if (selectedCommitHash && projectPath) {
          logger.info(`Fetching file content for past commit [${selectedCommitHash}]: ${filePath}`);
          
          // 1. まず現在の情報ベースでメタデータを取得
          const meta = await invoke<FileMetadata>("get_file_info", { path: filePath });
          
          // 2. 過去コミット時点のファイル内容・バイナリ判定を取得
          const result = await invoke<PreviewContent>("git_show_file_content", {
            path: projectPath,
            commitHash: selectedCommitHash,
            filePath: filePath,
          });

          // 3. メタデータを過去時点の情報で上書き・再構築
          setMetadata({
            ...meta,
            file_type: result.is_image ? "image" : meta.file_type,
            mime_type: result.mime_type,
          });

          // 4. 内容をセット
          setTextContent(result.content);
          lastModifiedRef.current = null; // 過去コミットプレビュー中は変更監視しない
        } else {
          // 通常の最新ファイルロード
          const meta = await invoke<FileMetadata>("get_file_info", { path: filePath });
          setMetadata(meta);
          lastModifiedRef.current = meta.modified;

          if (meta.file_type === "text" || meta.file_type === "image") {
            logger.info(`Fetching ${meta.file_type} content for: ${filePath}`);
            const result = await invoke<PreviewContent>("read_file_content", { path: filePath });
            setTextContent(result.content);
          } else {
            setTextContent(null);
          }
        }
      } catch (err) {
        logger.error(`Failed to load file data: ${err}`);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filePath, selectedCommitHash, projectPath]);

  // リアルタイム更新（ポーリング）- 過去コミットプレビュー中は停止
  useEffect(() => {
    if (!filePath || selectedCommitHash) return;

    const intervalId = setInterval(async () => {
      try {
        const newMeta = await invoke<FileMetadata>("get_file_info", { path: filePath });
        if (lastModifiedRef.current !== null && newMeta.modified !== lastModifiedRef.current) {
          logger.info(`Detected file modification: ${filePath}`);
          setMetadata(newMeta);
          lastModifiedRef.current = newMeta.modified;
          
          // テキストまたは画像なら中身もサイレント更新
          if (newMeta.file_type === "text" || newMeta.file_type === "image") {
            const result = await invoke<PreviewContent>("read_file_content", { path: filePath });
            setTextContent(result.content);
            if (newMeta.file_type === "text" && showDiff) {
              const diff = await invoke<string>("git_diff_file", { path: filePath });
              setDiffContent(diff);
            }
          }
        }
      } catch (err) {
        // ポーリング中のエラーは無視する
      }
    }, 1000); // 1秒間隔でチェック

    return () => clearInterval(intervalId);
  }, [filePath, selectedCommitHash, showDiff]);

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
        <p>{t("common.loading")}</p>
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

  const assetUrl = metadata?.file_type === "image" && textContent
    ? `data:${metadata.mime_type};base64,${textContent}`
    : (filePath ? convertFileSrc(filePath.replace(/\\/g, "/")) : "");

  return (
    <article className="file-preview-container" aria-label={t("common.aria.file_preview", { path: metadata?.name || filePath })}>
      {selectedCommitHash && (
        <div className="time-travel-bar">
          <div className="time-travel-status">
            <span className="time-travel-indicator" />
            <span className="time-travel-badge">
              {t("preview.time_traveling", { hash: selectedCommitHash.substring(0, 7) })}
            </span>
          </div>
          <button 
            className="time-travel-reset-btn"
            onClick={onClearCommitSelect}
          >
            {t("preview.action.back_to_latest")}
          </button>
        </div>
      )}

      <header className="preview-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <FileText size={16} style={{ flexShrink: 0 }} />
          <h3 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{metadata?.name || filePath}</h3>
        </div>
        <button 
          onClick={() => {
            if (metadata?.file_type === "text") {
              setShowDiff(!showDiff);
            }
          }}
          disabled={metadata?.file_type !== "text"}
          title={metadata?.file_type !== "text" ? t("preview.action.diff_disabled_tooltip") : undefined}
          style={{ 
            background: showDiff ? "var(--accent-color)" : "transparent",
            color: showDiff ? "white" : (metadata?.file_type !== "text" ? "var(--text-muted)" : "var(--text-color)"),
            border: `1px solid ${showDiff ? "var(--accent-color)" : "var(--border-color)"}`,
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "0.8rem",
            cursor: metadata?.file_type !== "text" ? "not-allowed" : "pointer",
            opacity: metadata?.file_type !== "text" ? 0.5 : 1,
            transition: "all 0.2s",
            flexShrink: 0
          }}
        >
          {showDiff ? t("preview.action.back_to_preview") : t("preview.action.show_diff")}
        </button>
      </header>
      
      <div className="preview-body">
        {metadata?.file_type === "image" && (
          <div className="image-preview">
            <img 
              src={assetUrl} 
              alt={t("common.aria.preview_of", { path: metadata?.name || filePath })} 
            />
          </div>
        )}

        {metadata?.file_type === "video" && (
          <div className="video-preview">
            <video 
              controls 
              src={assetUrl} 
              aria-label={t("common.aria.preview_of", { path: metadata?.name || filePath })}
            >
              {t("preview.video_not_supported")}
            </video>
          </div>
        )}

        {metadata?.file_type === "audio" && (
          <div className="audio-preview">
            <audio 
              controls 
              src={assetUrl} 
              aria-label={t("common.aria.preview_of", { path: metadata?.name || filePath })}
            >
              {t("preview.audio_not_supported")}
            </audio>
          </div>
        )}

        {metadata?.file_type === "text" && showDiff && diffContent !== null && (
          <pre className="text-preview diff-view" aria-readonly="true">
            <code>
              {diffContent ? diffContent.split('\n').map((line, i) => {
                let color = "inherit";
                let bg = "transparent";
                if (line.startsWith('+')) {
                  color = "#10b981"; // Emerald-500
                  bg = "rgba(16, 185, 129, 0.1)";
                } else if (line.startsWith('-')) {
                  color = "#ef4444"; // Red-500
                  bg = "rgba(239, 68, 68, 0.1)";
                } else if (line.startsWith('@@')) {
                  color = "#3b82f6"; // Blue-500
                  bg = "rgba(59, 130, 246, 0.1)";
                }
                return (
                  <div key={i} style={{ color, backgroundColor: bg, padding: "0 4px", minHeight: "1.2em", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {line}
                  </div>
                );
              }) : <div style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "16px" }}>{t("preview.no_changes")}</div>}
            </code>
          </pre>
        )}

        {metadata?.file_type === "text" && !showDiff && textContent !== null && (
          <pre className="text-preview" aria-readonly="true">
            <code>{textContent}</code>
          </pre>
        )}

        {metadata?.file_type === "unknown" && metadata && (
          <div className="info-card">
            <div className="info-icon-wrapper">
              <Info size={40} />
            </div>
            <div className="info-content">
              <h2>{t("preview.unknown_type.title")}</h2>
              <p className="info-message">
                {t("preview.unknown_type.message")}
              </p>
              
              <div className="info-details">
                <span className="detail-label">{t("common.file_name")}:</span>
                <span className="detail-value">{metadata.name}</span>
                
                <span className="detail-label">{t("common.file_size")}:</span>
                <span className="detail-value">{formatSize(metadata.size)}</span>
                
                <span className="detail-label">{t("common.last_modified")}:</span>
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
