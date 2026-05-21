import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
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

  // 競合ファイルの一覧を取得
  useEffect(() => {
    if (isOpen && projectPath) {
      setErrorMsg("");
      const fetchConflicts = async () => {
        setLoading(true);
        try {
          const list = await invoke<string[]>("git_get_conflicts", { path: projectPath });
          setFiles(list);
          // 初期状態では未選択
          setResolutions({});
        } catch (e) {
          logger.error(`競合取得エラー: ${e}`);
          setErrorMsg(t("conflict.error_loading"));
        } finally {
          setLoading(false);
        }
      };
      fetchConflicts();
    }
  }, [isOpen, projectPath, t]);

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
      logger.info("競合の解決処理を開始します...");
      for (const file of files) {
        await invoke("git_resolve_conflict", {
          path: projectPath,
          file,
          resolution: resolutions[file],
        });
      }
      
      // すべて解決したら、マージを完結させるためのコミットを実行
      logger.info("すべての競合を解決しました。マージコミットを作成します。");
      await invoke("git_commit", {
        path: projectPath,
        message: "本番への採用に伴う競合の解決",
      });

      onResolved();
    } catch (e) {
      logger.error(`解決処理エラー: ${e}`);
      setErrorMsg(t("conflict.error_resolving") + `\n${e}`);
    } finally {
      setCompleting(false);
    }
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
                <div key={file} className="conflict-item">
                  <div className="conflict-file-info">
                    <span className="file-name" title={file}>{file}</span>
                  </div>
                  <div className="resolve-options">
                    <button
                      className={`btn-res ${resolutions[file] === "current" ? "active current" : ""}`}
                      onClick={() => handleResolve(file, "current")}
                      title={t("conflict.current_branch")}
                    >
                      {t("conflict.current_branch")}
                    </button>
                    <button
                      className={`btn-res ${resolutions[file] === "main" ? "active main" : ""}`}
                      onClick={() => handleResolve(file, "main")}
                      title={t("conflict.main_branch")}
                    >
                      {t("conflict.main_branch")}
                    </button>
                  </div>
                </div>
              ))}
              {files.length === 0 && !loading && (
                <p className="no-conflicts">競合しているファイルはありません。</p>
              )}
            </div>
          )}
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
