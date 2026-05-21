import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, GitBranch, Loader2, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import "./CommitMessageModal.css"; // Reuse the same CSS for modal structure

interface SwitchBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: (branchName: string) => void;
  projectPath: string | null;
  currentBranch: string;
}

const SwitchBranchModal: FC<SwitchBranchModalProps> = ({
  isOpen,
  onClose,
  onSwitch,
  projectPath,
  currentBranch,
}) => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && projectPath) {
      setErrorMsg("");
      setLoading(true);
      logger.debug("ルート切り替えモーダルが開いたよ");
      
      const fetchBranches = async () => {
        try {
          const list = await invoke<string[]>("git_get_branches", { path: projectPath });
          setBranches(list);
        } catch (error) {
          logger.error(`ブランチ一覧取得エラー: ${error}`);
          setErrorMsg("ルートの一覧を取得できなかったよ...");
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
            ルートの切り替え
          </h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </header>

        <div className="commit-modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <p className="commit-modal-desc">
            別のルートに切り替えると、ファイルの状態がそのルートのものに変化します。
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
              {branches.map(branch => (
                <button
                  key={branch}
                  onClick={() => {
                    if (branch !== currentBranch) {
                      onSwitch(branch);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    backgroundColor: branch === currentBranch ? "var(--accent-color)" : "var(--panel-bg)",
                    color: branch === currentBranch ? "white" : "var(--text-color)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    cursor: branch === currentBranch ? "default" : "pointer",
                    transition: "all 0.2s",
                    opacity: branch === currentBranch ? 0.9 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (branch !== currentBranch) {
                      e.currentTarget.style.backgroundColor = "var(--item-hover)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (branch !== currentBranch) {
                      e.currentTarget.style.backgroundColor = "var(--panel-bg)";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <GitBranch size={16} />
                    <span style={{ fontWeight: branch === currentBranch ? "bold" : "normal" }}>
                      {branch}
                    </span>
                  </div>
                  {branch === currentBranch && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="commit-modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
          >
            キャンセル
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SwitchBranchModal;
