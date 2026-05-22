import { type FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Save, MessageSquare } from "lucide-react";
import logger from "../../utils/logger";
import "./CommitMessageModal.css";

interface CommitMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (message: string) => void;
  defaultMessage: string;
}

/**
 * Accessibility Strategy:
 * - Role "dialog" and aria-modal="true" for screen reader context.
 * - Aria-labelledby to associate the modal title with the dialog.
 * - Focus Management: Auto-focus the input on mount, trap focus inside, reset scroll.
 * - Handle Escape key to close the modal.
 * - Form submit handler to process input cleanly.
 */
const CommitMessageModal: FC<CommitMessageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultMessage,
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // モーダルが開いた時にインプットにフォーカスし、Escapeキー監視を開始
  useEffect(() => {
    if (isOpen) {
      setMessage(""); // 開くたびにクリア
      logger.debug("Commit message modal opened.");
      
      // アニメーション完了後にフォーカスするために少し遅延を入れる
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          logger.debug("Closing commit message modal via Escape key.");
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

  // フォーカストラップ制御 (Tabキーのループ)
  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current || e.key !== "Tab") return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex="0"]'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab: 最初の要素から最後の要素へフォーカス移動
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab: 最後の要素から最初の要素へフォーカス移動
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
    // 入力が空の場合はデフォルトメッセージを使用
    const finalMessage = message.trim() || defaultMessage;
    logger.info(`Commit message decided: ${finalMessage}`);
    onSave(finalMessage);
  };

  return (
    <div
      className="commit-modal-overlay"
      onClick={() => {
        logger.debug("Closing commit message modal via overlay click.");
        onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="commit-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="commit-modal-title"
      >
        <header className="commit-modal-header">
          <h2 id="commit-modal-title">
            <MessageSquare size={18} className="header-icon" />
            {t("help.commands.save.name")}
          </h2>
          <button
            className="close-btn"
            onClick={() => {
              logger.debug("Closing commit message modal via close button.");
              onClose();
            }}
            aria-label={t("common.action.close")}
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="commit-modal-form">
          <div className="commit-modal-body">
            <p className="commit-modal-desc">
              {t("commit.modal.desc")}
            </p>
            
            <div className="input-group">
              <label htmlFor="commit-msg-input">
                {t("commit.modal.input_label")}
              </label>
              <input
                id="commit-msg-input"
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={defaultMessage}
                maxLength={100}
                className="commit-input"
              />
              <span className="input-tip">
                {t("commit.modal.input_tip")}
              </span>
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
              <Save size={14} />
              <span>{t("help.commands.save.op")}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CommitMessageModal;
