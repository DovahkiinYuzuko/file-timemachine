import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, GitBranch, Loader2, Check, Trash2, Pencil } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import "./CommitMessageModal.css"; // Reuse the same CSS for modal structure

interface SwitchBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: (branchName: string) => void;
  projectPath: string | null;
  currentBranch: string;
  mainBranchName: string;
  onDeleted?: () => void;
  onRenamed?: (oldName: string, newName: string) => void;
}

const SwitchBranchModal: FC<SwitchBranchModalProps> = ({
  isOpen,
  onClose,
  onSwitch,
  projectPath,
  currentBranch,
  mainBranchName,
  onDeleted,
  onRenamed,
}) => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);

  // ブランチ名バリデーションヘルパー
  const validateBranchName = (name: string): string | null => {
    if (!name.trim()) {
      return t("branch.rename.error_empty");
    }
    const branchNameRegex = /^[a-zA-Z0-9\-_./]+$/;
    if (!branchNameRegex.test(name)) {
      return t("branch.rename.error_invalid");
    }
    return null;
  };

  // エラー翻訳ヘルパー
  const translateError = (error: string): string => {
    if (error.includes(":")) {
      const [key, ...rest] = error.split(":");
      const detail = rest.join(":");
      return t(key) + "\n" + t("common.detail") + ": " + detail;
    }
    return t(error);
  };

  // ブランチ名変更処理
  const handleRenameBranch = async (oldName: string, newName: string) => {
    if (!projectPath) return;

    const trimmedNewName = newName.trim();
    if (trimmedNewName === oldName) {
      setEditingBranch(null);
      return;
    }

    const validationError = validateBranchName(trimmedNewName);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      logger.info(`Renaming branch from ${oldName} to ${trimmedNewName}`);
      const result = await invoke<string>("git_rename_branch", {
        path: projectPath,
        oldName,
        newName: trimmedNewName,
      });
      logger.info(result);

      // ブランチ一覧を再取得
      const list = await invoke<string[]>("git_get_branches", { path: projectPath });
      setBranches(list);

      // 親側にも名前変更を通知
      if (onRenamed) {
        onRenamed(oldName, trimmedNewName);
      }

      alert(t(result));
      setEditingBranch(null);
    } catch (error) {
      logger.error(`Failed to rename branch: ${error}`);
      alert(translateError(String(error)));
    } finally {
      setLoading(false);
    }
  };

  // ブランチ削除処理
  const handleDeleteBranch = async (branchName: string) => {
    if (!projectPath) return;

    const confirmDelete = window.confirm(
      t("branch.delete.confirm", { name: branchName })
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      setErrorMsg("");
      logger.info(`Deleting branch: ${branchName}`);
      const result = await invoke<string>("git_delete_branch", { 
        path: projectPath, 
        branchName 
      });
      logger.info(result);

      // ブランチ一覧を再取得
      const list = await invoke<string[]>("git_get_branches", { path: projectPath });
      setBranches(list);

      // 履歴一覧リフレッシュ用のコールバックを起動
      if (onDeleted) {
        onDeleted();
      }

      alert(t("branch.delete.success", { name: branchName }));
    } catch (error) {
      logger.error(`Failed to delete branch: ${error}`);
      setErrorMsg(translateError(String(error)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && projectPath) {
      setErrorMsg("");
      setLoading(true);
      logger.debug("Switch branch modal opened");
      
      const fetchBranches = async () => {
        try {
          const list = await invoke<string[]>("git_get_branches", { path: projectPath });
          setBranches(list);
        } catch (error) {
          logger.error(`Failed to get branch list: ${error}`);
          setErrorMsg(t("branch.switch.error_fetch"));
        } finally {
          setLoading(false);
        }
      };

      fetchBranches();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, projectPath, onClose]);

  // Focus trap
  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current || e.key !== "Tab") return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex="0"]'
      );
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleFocusTrap);
    return () => window.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="commit-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="commit-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-modal-title"
      >
        <header className="commit-modal-header">
          <h2 id="switch-modal-title">
            <GitBranch size={18} className="header-icon" />
            {t("branch.switch.title")}
          </h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label={t("common.action.close")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="commit-modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <p className="commit-modal-desc">
            {t("branch.switch.desc")}
          </p>
          
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : errorMsg ? (
            <div style={{ color: "var(--danger-color)", padding: "1rem 0" }}>
              {errorMsg}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "1rem" }}>
              {branches.map(branch => {
                const isCurrent = branch === currentBranch;
                const isEditing = editingBranch === branch;
                return (
                  <div
                    key={branch}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px",
                      backgroundColor: isCurrent ? "var(--accent-color)" : "var(--panel-bg)",
                      color: isCurrent ? "white" : "var(--text-color)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      transition: "all 0.2s",
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                        <GitBranch size={16} style={{ color: isCurrent ? "white" : "var(--text-muted)" }} />
                        <input
                          type="text"
                          value={editNameInput}
                          onChange={(e) => setEditNameInput(e.target.value)}
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid var(--border-color)",
                            backgroundColor: "var(--bg-color)",
                            color: "var(--text-color)",
                            outline: "none",
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameBranch(branch, editNameInput);
                            } else if (e.key === "Escape") {
                              setEditingBranch(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRenameBranch(branch, editNameInput)}
                          style={{
                            background: "none",
                            border: "none",
                            color: isCurrent ? "white" : "var(--accent-color)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingBranch(null)}
                          style={{
                            background: "none",
                            border: "none",
                            color: isCurrent ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            if (!isCurrent) {
                              onSwitch(branch);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            background: "none",
                            border: "none",
                            color: "inherit",
                            cursor: isCurrent ? "default" : "pointer",
                            flex: 1,
                            textAlign: "left",
                            padding: 0,
                            fontWeight: isCurrent ? "bold" : "normal",
                          }}
                        >
                          <GitBranch size={16} />
                          <span>{branch}</span>
                          {isCurrent && <Check size={16} style={{ marginLeft: "8px" }} />}
                        </button>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBranch(branch);
                                setEditNameInput(branch);
                              }}
                              title={t("branch.rename.tooltip")}
                              style={{
                                background: "none",
                                border: "none",
                                color: isCurrent ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "4px",
                                transition: "all 0.2s",
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.color = isCurrent ? "white" : "var(--accent-color)";
                                e.currentTarget.style.backgroundColor = isCurrent ? "rgba(255,255,255,0.15)" : "rgba(128, 128, 128, 0.15)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.color = isCurrent ? "rgba(255,255,255,0.7)" : "var(--text-muted)";
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <Pencil size={16} />
                            </button>

                          {branch !== mainBranchName && !isCurrent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBranch(branch);
                              }}
                              title={t("branch.delete.tooltip")}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "4px",
                                transition: "all 0.2s",
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.color = "var(--danger-color)";
                                e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.15)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.color = "var(--text-muted)";
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="commit-modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
          >
            {t("common.action.cancel")}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SwitchBranchModal;
