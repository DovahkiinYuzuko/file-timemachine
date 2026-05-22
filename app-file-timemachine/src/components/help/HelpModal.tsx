import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, CheckCircle, GitBranch, RefreshCw, Search, Home } from "lucide-react";
import "./HelpModal.css";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Accessibility Strategy:
 * - role="dialog" and aria-modal="true" for the modal container.
 * - aria-labelledby points to the modal title.
 * - Trap focus within the modal (simplified here, but Escape key handling is included).
 * - Close button has aria-label.
 */
const HelpModal: FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const gitCommands = [
    { key: "save", icon: CheckCircle },
    { key: "trial", icon: GitBranch },
    { key: "switch", icon: RefreshCw },
    { key: "merge", icon: CheckCircle },
    { key: "search", icon: Search },
    { key: "sync", icon: Home },
  ];

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div 
        className="help-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help-modal-header">
          <h2 id="help-modal-title">{t("help.title")}</h2>
          <button 
            className="help-modal-close-btn" 
            onClick={onClose}
            aria-label={t("common.action.close")}
          >
            <X size={24} />
          </button>
        </header>
        
        <div className="help-modal-content">
          <p>{t("help.description")}</p>
          
          <table className="git-commands-table">
            <thead>
              <tr>
                <th>{t("help.table.operation")}</th>
                <th>{t("help.table.command")}</th>
                <th>{t("help.table.explanation")}</th>
              </tr>
            </thead>
            <tbody>
              {gitCommands.map((item) => {
                const Icon = item.icon;
                return (
                  <tr key={item.key}>
                    <td>
                      <div className="git-command-op-container">
                        <Icon size={18} className="git-command-icon" aria-hidden="true" />
                        {t(`help.commands.${item.key}.op`)}
                      </div>
                    </td>
                    <td><code>{t(`help.commands.${item.key}.cmd`)}</code></td>
                    <td>{t(`help.commands.${item.key}.desc`)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="help-modal-footer">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {t("help.footer")}
          </p>
          <button className="help-modal-footer-btn" onClick={onClose}>
            OK
          </button>
        </footer>
      </div>
    </div>
  );
};


export default HelpModal;
