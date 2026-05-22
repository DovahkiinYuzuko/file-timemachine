import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { CheckCircle2, XCircle, Loader2, Download, Terminal } from "lucide-react";
import logger from "../../utils/logger";
import "./Wizard.css";

interface DependencyStatus {
  git: boolean;
  brew: boolean;
  gh: boolean;
}

interface InstallLogPayload {
  message: string;
}

interface WizardProps {
  onComplete: () => void;
}

export default function Wizard({ onComplete }: WizardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [installingTool, setInstallingTool] = useState<"git" | "gh" | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  const checkDeps = async () => {
    setLoading(true);
    setError(null);
    logger.info("依存関係の診断を開始します");
    try {
      const result = await invoke<DependencyStatus>("check_dependencies", { simulate: false });
      setStatus(result);
      logger.debug(`診断結果: Git=${result.git}, Brew=${result.brew}, gh=${result.gh}`);
    } catch (e) {
      const errMsg = String(e);
      logger.error(`診断中にエラーが発生しました: ${errMsg}`);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDeps();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [installLogs]);

  const handleInstall = async (tool: "git" | "gh") => {
    setInstallingTool(tool);
    setInstallProgress(0);
    setInstallLogs([]);
    setError(null);

    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await listen<InstallLogPayload>("install-log", (event) => {
        setInstallLogs((prev) => [...prev, event.payload.message]);
        
        // Progress heuristic for installation (just for visuals)
        setInstallProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      });

      await invoke("install_dependency", { tool, simulate: false });
      
      setInstallProgress(100);
      setInstallLogs((prev) => [...prev, t("setup.install_success", { tool })]);
      
      // Wait a bit before checking deps again
      setTimeout(() => {
        setInstallingTool(null);
        checkDeps();
      }, 2000);
    } catch (e) {
      const errMsg = String(e);
      setInstallLogs((prev) => [...prev, t("setup.install_failed") + errMsg]);
      setError(errMsg);
      setTimeout(() => {
        setInstallingTool(null);
      }, 3000);
    } finally {
      if (unlisten) {
        unlisten();
      }
    }
  };
  
  // Git is required, GitHub CLI is optional
  const allInstalled = status ? status.git : false;

  return (
    <main className="wizard-container">
      <div className="wizard-card">
        <h1 className="wizard-title">{t("setup.title")}</h1>
        <p className="wizard-description">{t("setup.description")}</p>

        <div className="wizard-content" aria-live="polite">
          {installingTool ? (
            <div className="wizard-installing">
              <div className="installing-header">
                <Download className="animate-bounce" />
                <h2>{t("setup.installing_status")} ({installingTool})</h2>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${installProgress}%` }}></div>
              </div>
              <div className="wizard-terminal">
                <div className="terminal-header">
                  <Terminal size={16} />
                  <span>{t("setup.log_title")}</span>
                </div>
                <div className="terminal-body">
                  {installLogs.map((log, i) => (
                    <div key={i} className="terminal-line">{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="wizard-loading">
              <Loader2 className="animate-spin" />
              <span>{t("setup.checking")}</span>
            </div>
          ) : error ? (
            <div className="wizard-error">
              <p>{error}</p>
              <button onClick={() => checkDeps()} className="wizard-button">
                {t("setup.retry")}
              </button>
            </div>
          ) : (
            <div className="wizard-results">
              <ul className="dependency-list">
                <DependencyItem
                  label={t("setup.git")}
                  description={t("setup.git_required_desc")}
                  installed={status?.git}
                  installGuide="https://git-scm.com/downloads"
                  onInstall={() => handleInstall("git")}
                />
                <DependencyItem
                  label={t("setup.gh") + " " + t("setup.optional")}
                  description={t("setup.gh_optional_desc")}
                  installed={status?.gh}
                  installGuide="https://cli.github.com/"
                  onInstall={() => handleInstall("gh")}
                  isOptional
                />
              </ul>

              {!allInstalled && (
                <p className="wizard-guide-alert">{t("setup.guide_missing")}</p>
              )}

              <div className="wizard-actions">
                <button
                  onClick={onComplete}
                  disabled={!allInstalled}
                  className={`wizard-button ${allInstalled ? "primary" : ""}`}
                >
                  {allInstalled ? t("setup.finish") : t("setup.next")}
                </button>
                {!allInstalled && (
                  <button onClick={() => checkDeps()} className="wizard-button secondary">
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
  description?: string;
  installed?: boolean;
  installGuide: string;
  onInstall: () => void;
  isOptional?: boolean;
}

function DependencyItem({ label, description, installed, installGuide, onInstall, isOptional }: DependencyItemProps) {
  const { t } = useTranslation();
  return (
    <li className={`dependency-item ${isOptional ? "optional-item" : ""}`}>
      <div className="dependency-info">
        {installed ? (
          <CheckCircle2 className="icon-success" aria-hidden="true" />
        ) : (
          <XCircle className="icon-error" aria-hidden="true" />
        )}
        <div className="dependency-text">
          <span className="dependency-label">{label}</span>
          {description && <span className="dependency-desc">{description}</span>}
        </div>
      </div>
      <div className="dependency-status">
        {installed ? (
          <span className="status-installed">{t("setup.status_installed")}</span>
        ) : (
          <div className="status-actions">
            <button className="wizard-install-btn" onClick={onInstall}>
              {t("setup.install_btn")}
            </button>
            <a
              href={installGuide}
              target="_blank"
              rel="noopener noreferrer"
              className="status-missing-link"
            >
              Manual
            </a>
          </div>
        )}
      </div>
    </li>
  );
}
