import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, GitBranchPlus } from "lucide-react";
import logger from "../../utils/logger";
import "./CommitMessageModal.css"; // Reuse the same CSS for modal structure

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (branchName: string) => void;
}

const CreateBranchModal: FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [branchName, setBranchName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setBranchName("");
      setErrorMsg("");
      logger.debug("新しいルート作成モーダルが開きました");
      
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current || e.key !== "Tab") return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex="0"]'
      );
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = branchName.trim();
    
    // 基本的なブランチ名のバリデーション
    const isValid = /^[a-zA-Z0-9\-_]+$/.test(finalName);
    
    if (!finalName) {
      setErrorMsg(t("branch.modal.error_empty"));
      return;
    }
    
    if (!isValid) {
      setErrorMsg(t("branch.modal.error_invalid"));
      return;
    }
    
    logger.info(`新しいルート名を決定しました: ${finalName}`);
    onSave(finalName);
  };

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
        aria-labelledby="branch-modal-title"
      >
        <header className="commit-modal-header">
          <h2 id="branch-modal-title">
            <GitBranchPlus size={18} className="header-icon" />
            {t("branch.modal.title")}
          </h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label={t("common.action.close")}
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="commit-modal-form">
          <div className="commit-modal-body">
            <p className="commit-modal-desc">
              {t("branch.modal.desc")}
            </p>
            
            <div className="input-group">
              <label htmlFor="branch-name-input">
                {t("branch.modal.input_label")}
              </label>
              <input
                id="branch-name-input"
                ref={inputRef}
                type="text"
                value={branchName}
                onChange={(e) => {
                  setBranchName(e.target.value);
                  setErrorMsg("");
                }}
                placeholder={t("branch.modal.placeholder")}
                maxLength={50}
                className={`commit-input ${errorMsg ? 'error' : ''}`}
              />
              {errorMsg ? (
                <span className="input-tip" style={{ color: "var(--danger-color)" }}>
                  {errorMsg}
                </span>
              ) : (
                <span className="input-tip">
                  {t("branch.modal.input_tip")}
                </span>
              )}
            </div>
          </div>

          <footer className="commit-modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
            >
              {t("common.action.cancel")}
            </button>
            <button
              type="submit"
              className="btn-submit"
            >
              <GitBranchPlus size={14} />
              <span>{t("branch.modal.submit")}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreateBranchModal;
