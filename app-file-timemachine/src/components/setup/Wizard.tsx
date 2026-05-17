import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import logger from "../../utils/logger";
import "./Wizard.css";

interface DependencyStatus {
  git: boolean;
  brew: boolean;
  gh: boolean;
}

interface WizardProps {
  onComplete: () => void;
}

export default function Wizard({ onComplete }: WizardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkDeps = async () => {
    setLoading(true);
    setError(null);
    logger.info("依存関係の診断を開始するよ");
    try {
      const result = await invoke<DependencyStatus>("check_dependencies");
      setStatus(result);
      logger.debug(`診断結果: Git=${result.git}, Brew=${result.brew}, gh=${result.gh}`);
    } catch (e) {
      const errMsg = String(e);
      logger.error(`診断中にエラーが発生したよ: ${errMsg}`);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDeps();
  }, []);

  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const allInstalled = status ? status.git && status.gh && (isMac ? status.brew : true) : false;

  return (
    <main className="wizard-container">
      <div className="wizard-card">
        <h1 className="wizard-title">{t("setup.title")}</h1>
        <p className="wizard-description">{t("setup.description")}</p>

        <div className="wizard-content" aria-live="polite">
          {loading ? (
            <div className="wizard-loading">
              <Loader2 className="animate-spin" />
              <span>{t("setup.checking")}</span>
            </div>
          ) : error ? (
            <div className="wizard-error">
              <p>{error}</p>
              <button onClick={checkDeps} className="wizard-button">
                {t("setup.retry")}
              </button>
            </div>
          ) : (
            <div className="wizard-results">
              <ul className="dependency-list">
                <DependencyItem
                  label={t("setup.git")}
                  installed={status?.git}
                  installGuide="https://git-scm.com/downloads"
                />
                {isMac && (
                  <DependencyItem
                    label={t("setup.brew")}
                    installed={status?.brew}
                    installGuide="https://brew.sh/"
                  />
                )}
                <DependencyItem
                  label={t("setup.gh")}
                  installed={status?.gh}
                  installGuide="https://cli.github.com/"
                />
              </ul>

              {!allInstalled && (
                <p className="wizard-guide-alert">{t("setup.guide_missing")}</p>
              )}

              <div className="wizard-actions">
                <button
                  onClick={onComplete}
                  className={`wizard-button ${allInstalled ? "primary" : ""}`}
                >
                  {allInstalled ? t("setup.finish") : t("setup.next")}
                </button>
                {!allInstalled && (
                  <button onClick={checkDeps} className="wizard-button secondary">
                    {t("setup.retry")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

interface DependencyItemProps {
  label: string;
  installed?: boolean;
  installGuide: string;
}

function DependencyItem({ label, installed, installGuide }: DependencyItemProps) {
  const { t } = useTranslation();
  return (
    <li className="dependency-item">
      <div className="dependency-info">
        {installed ? (
          <CheckCircle2 className="icon-success" aria-hidden="true" />
        ) : (
          <XCircle className="icon-error" aria-hidden="true" />
        )}
        <span className="dependency-label">{label}</span>
      </div>
      <div className="dependency-status">
        {installed ? (
          <span className="status-installed">{t("setup.status_installed")}</span>
        ) : (
          <a
            href={installGuide}
            target="_blank"
            rel="noopener noreferrer"
            className="status-missing"
          >
            {t("setup.status_missing")} (Guide)
          </a>
        )}
      </div>
    </li>
  );
}
