import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2, X, Eye } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import "./ConflictResolverModal.css";

interface ConflictResolverModalProps {
  isOpen: boolean;
  projectPath: string | null;
  onResolved: () => void;
  onCancel: () => void;
}

/**
 * ConflictResolverModal
 * マージ競合が発生した際に、ユーザーがファイルごとにどちらの内容を採用するか選択するためのモーダル。
 * 左右2ペイン構造で、ファイルリストと内容プレビューを表示する。
 */
const ConflictResolverModal: FC<ConflictResolverModalProps> = ({
  isOpen,
  projectPath,
  onResolved,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "current" | "main">>({});
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // プレビュー用のステート
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 競合ファイルの一覧を取得
  useEffect(() => {
    if (isOpen && projectPath) {
      setErrorMsg("");
      const fetchConflicts = async () => {
        setLoading(true);
        try {
          const list = await invoke<string[]>("git_get_conflicts", { path: projectPath });
          setFiles(list);
          setResolutions({});
          // 最初のファイルがあれば選択
          if (list.length > 0) {
            setSelectedFile(list[0]);
          }
        } catch (e) {
          logger.error(`Error fetching conflicts: ${e}`);
          setErrorMsg(t(e as string));
        } finally {
          setLoading(false);
        }
      };
      fetchConflicts();
    } else {
      // 閉じた時はリセット
      setSelectedFile(null);
      setPreviewContent(null);
    }
  }, [isOpen, projectPath, t]);

  // ファイル選択時の読み込み
  useEffect(() => {
    if (selectedFile && projectPath) {
      const loadContent = async () => {
        setPreviewLoading(true);
        try {
          // パス結合の正規化（スラッシュの重複を避ける）
          const separator = projectPath.endsWith("/") || projectPath.endsWith("\\") ? "" : "/";
          const fullPath = `${projectPath}${separator}${selectedFile}`;
          
          // Rust側の read_file_content コマンドを使用
          const res = await invoke<{
            content: string, 
            is_image: boolean, 
            is_binary: boolean,
            mime_type: string 
          }>("read_file_content", { 
            path: fullPath
          });

          if (res.is_binary && !res.is_image) {
            setPreviewContent("BINARY_FILE_PLACEHOLDER");
          } else {
            setPreviewContent(res.content);
          }
        } catch (e) {
          logger.error(`Preview load error: ${e}`);
          setPreviewContent(`ERROR:${e}`);
        } finally {
          setPreviewLoading(false);
        }
      };
      loadContent();
    }
  }, [selectedFile, projectPath]);

  // Focus trap and Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  const handleResolve = (file: string, res: "current" | "main") => {
    setResolutions((prev) => ({ ...prev, [file]: res }));
  };

  const handleComplete = async () => {
    if (!projectPath) return;
    setCompleting(true);
    setErrorMsg("");
    try {
      logger.info("Starting conflict resolution...");
      for (const file of files) {
        await invoke("git_resolve_conflict", {
          path: projectPath,
          file,
          resolution: resolutions[file],
        });
      }

      logger.info("All conflicts resolved. Creating a merge commit.");
      await invoke("git_commit", {
        path: projectPath,
        message: t("conflict.commit_message"),
      });

      onResolved();
    } catch (e) {
      logger.error(`Error resolving conflict: ${e}`);
      setErrorMsg(t(e as string));
    } finally {
      setCompleting(false);
    }
  };

  // 競合マーカーに基づいた行のクラス分け
  const getLineClass = (line: string): string => {
    if (line.startsWith("<<<<<<<") || line.startsWith("=======") || line.startsWith(">>>>>>>") || line.startsWith("+++++++")) {
      return "line-conflict-marker";
    }
    return "";
  };

  const renderPreviewContent = () => {
    if (previewLoading) {
      return (
        <div className="preview-placeholder">
          <Loader2 className="animate-spin" size={24} />
          <span>{t("conflict.loading_content")}</span>
        </div>
      );
    }

    if (!previewContent) {
      return (
        <div className="preview-placeholder">
          <span>{t("conflict.select_to_preview")}</span>
        </div>
      );
    }

    if (previewContent === "BINARY_FILE_PLACEHOLDER") {
      return (
        <div className="preview-placeholder">
          <AlertTriangle size={32} />
          <span>{t("common.placeholder.binary_file_preview_not_supported")}</span>
        </div>
      );
    }

    if (previewContent.startsWith("ERROR:")) {
      const errorCode = previewContent.replace("ERROR:", "");
      return (
        <div className="preview-placeholder error">
          <AlertTriangle size={32} />
          <span>{t(errorCode)}</span>
        </div>
      );
    }

    return (
      <pre className="preview-code">
        {previewContent.split('\n').map((line, i) => (
          <div key={i} className={getLineClass(line)}>{line}</div>
        ))}
      </pre>
    );
  };

  if (!isOpen) return null;

  const allResolved = files.length > 0 && files.every((f) => resolutions[f]);

  return (
    <div className="commit-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        ref={modalRef}
        className="commit-modal-content conflict-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="commit-modal-header">
          <h2 id="conflict-title">
            <AlertTriangle size={20} className="header-icon warning" />
            {t("conflict.title")}
          </h2>
          <button className="close-btn" onClick={onCancel} aria-label={t("common.action.close")}>
            <X size={18} />
          </button>
        </header>

        <div className="commit-modal-body">
          <p className="commit-modal-desc">{t("conflict.description")}</p>

          <div className="conflict-layout-container">
            {/* 左側：ファイルリスト */}
            <aside className="conflict-sidebar">
              {loading ? (
                <div className="loading-container">
                  <Loader2 className="animate-spin" size={32} />
                </div>
              ) : errorMsg ? (
                <div className="error-message">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              ) : (
                <div className="conflict-list">
                  {files.map((file) => (
                    <div 
                      key={file} 
                      className={`conflict-item ${selectedFile === file ? "selected" : ""}`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="conflict-file-info">
                        <span className="file-name" title={file}>{file}</span>
                      </div>
                      <div className="resolve-options">
                        <button
                          className={`btn-res ${resolutions[file] === "current" ? "active current" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(file, "current");
                          }}
                          title={t("conflict.current_branch")}
                        >
                          {t("conflict.current_branch")}
                        </button>
                        <button
                          className={`btn-res ${resolutions[file] === "main" ? "active main" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(file, "main");
                          }}
                          title={t("conflict.main_branch")}
                        >
                          {t("conflict.main_branch")}
                        </button>
                      </div>
                    </div>
                  ))}
                  {files.length === 0 && !loading && (
                    <p className="no-conflicts">{t("conflict.no_conflicts")}</p>
                  )}
                </div>
              )}
            </aside>

            {/* 右側：プレビュー領域 */}
            <main className="conflict-preview-area">
              <header className="preview-header">
                <Eye size={16} />
                <h3>{t("conflict.preview_title")}</h3>
              </header>
              <div className="preview-body">
                {renderPreviewContent()}
              </div>
            </main>
          </div>
        </div>

        <footer className="commit-modal-footer">
          <button className="btn-cancel" onClick={onCancel} disabled={completing}>
            {t("conflict.abort")}
          </button>
          <button
            className="btn-save btn-resolve-complete"
            disabled={!allResolved || completing}
            onClick={handleComplete}
          >
            {completing ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Check size={18} />
            )}
            <span>{t("conflict.resolve_and_merge")}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ConflictResolverModal;
