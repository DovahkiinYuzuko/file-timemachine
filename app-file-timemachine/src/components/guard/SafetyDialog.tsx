import { type FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SafetyIssue } from "../../utils/safety";
import "./SafetyDialog.css";

interface SafetyDialogProps {
  isOpen: boolean;
  issues: SafetyIssue[];
  onClose: () => void;
  onConfirmAnyway: () => void;
  onConfirmExclude: () => void;
}

/**
 * 安全ガードダイアログコンポーネント
 * 
 * Accessibility:
 * - role="dialog" と aria-modal="true" を使用
 * - ダイアログ表示時に最初のボタンにフォーカスを移動
 * - Escapeキーでダイアログを閉じる
 * - タイトルと説明を aria-labelledby / aria-describedby で紐付け
 */
const SafetyDialog: FC<SafetyDialogProps> = ({
  isOpen,
  issues,
  onClose,
  onConfirmAnyway,
  onConfirmExclude,
}) => {
  const { t } = useTranslation();
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  // ダイアログが開いた時のフォーカス管理とキーボードイベント
  useEffect(() => {
    if (isOpen) {
      // ちょっと待ってからフォーカスを当てる（レンダリング完了後）
      setTimeout(() => firstBtnRef.current?.focus(), 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="safety-dialog-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="safety-dialog-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-dialog-title"
        aria-describedby="safety-dialog-desc"
        onClick={(e) => e.stopPropagation()} // 背景クリックで閉じないように
      >
        <header className="safety-dialog-header">
          <span className="safety-dialog-warning-icon" aria-hidden="true">⚠️</span>
          <h2 id="safety-dialog-title">{t("safety.title")}</h2>
        </header>

        <div className="safety-dialog-body">
          <p id="safety-dialog-desc" className="safety-dialog-description">
            {t("safety.description")}
          </p>

          <div className="safety-issue-list">
            <h3>{t("safety.issue_list_title")}</h3>
            <ul>
              {issues.map((issue, index) => (
                <li
                  key={`${issue.path}-${index}`}
                  className={`safety-issue-item ${issue.type}`}
                >
                  <span className="issue-path">{issue.path}</span>
                  <span className="issue-reason">
                    {t(`safety.reason.${issue.reason}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="safety-dialog-footer">
          <button
            className="safety-btn safety-btn-cancel"
            onClick={onClose}
          >
            {t("safety.action.cancel")}
          </button>
          <button
            className="safety-btn safety-btn-anyway"
            onClick={onConfirmAnyway}
          >
            {t("safety.action.save_anyway")}
          </button>
          <button
            ref={firstBtnRef}
            className="safety-btn safety-btn-exclude"
            onClick={onConfirmExclude}
          >
            {t("safety.action.exclude_and_save")}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SafetyDialog;
