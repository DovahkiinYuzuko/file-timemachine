import { type FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, GitBranch, Languages, Settings2, ShieldCheck, Cpu, Palette, LogOut, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import { getAppConfig, updateAppConfig } from "../../api/config";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SaveBehavior = "confirm" | "auto" | "none";
type Theme = "light" | "dark";

// Custom Github Icon using standard SVG path (since brand icons are not present in lucide-react)
const Github: FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

/**
 * Accessibility Strategy:
 * - Role "dialog" and aria-modal="true" for the modal.
 * - Focus management: Focus trapped inside modal when open (simplified here).
 * - Close on Escape key and close button.
 * - Labels for all form controls (Theme, Language, Behavior).
 * - Semantic sections for grouped settings.
 */
const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [saveBehavior, setSaveBehavior] = useState<SaveBehavior>("confirm");
  const [autoScan, setAutoScan] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [isLoaded, setIsLoaded] = useState(false);

  // GitHub integration states
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubAvatar, setGithubAvatar] = useState<string | null>(null);
  const [patInput, setPatInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [showPatInput, setShowPatInput] = useState(false);

  // GitHub user profile fetcher
  const fetchGithubUser = async (token: string) => {
    setIsVerifying(true);
    setGithubError(null);
    try {
      logger.info("GitHubユーザー情報の取得を開始します");
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setGithubUsername(data.login);
        setGithubAvatar(data.avatar_url);
        // Save to AppConfig
        await updateAppConfig({
          github_token: token,
          github_username: data.login,
        });
        logger.info(`GitHub連携に成功しました: ${data.login}`);
      } else {
        const errText = await res.text();
        logger.error(`GitHubユーザー情報の取得エラー: ${res.status} ${errText}`);
        setGithubError(t("settings.github.invalid_token_error"));
        // Clear invalid token
        setGithubToken(null);
        setGithubUsername(null);
        setGithubAvatar(null);
        await updateAppConfig({
          github_token: null,
          github_username: null,
        });
      }
    } catch (err) {
      logger.error(`GitHubユーザー情報の取得に失敗しました: ${err}`);
      setGithubError(t("settings.github.connection_error"));
    } finally {
      setIsVerifying(false);
    }
  };

  // Load settings from AppConfig on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const config = await getAppConfig();
        
        if (config.settings_save_behavior) {
          setSaveBehavior(config.settings_save_behavior as SaveBehavior);
          logger.debug(`設定を読み込んだよ: 保存挙動 = ${config.settings_save_behavior}`);
        }
        if (config.settings_auto_scan !== null) {
          setAutoScan(config.settings_auto_scan);
          logger.debug(`設定を読み込んだよ: 自動スキャン = ${config.settings_auto_scan}`);
        }
        if (config.settings_theme) {
          setTheme(config.settings_theme as Theme);
          logger.debug(`設定を読み込んだよ: テーマ = ${config.settings_theme}`);
          document.documentElement.setAttribute("data-theme", config.settings_theme);
        }
        if (config.github_token) {
          setGithubToken(config.github_token);
          setGithubUsername(config.github_username);
          // Token matches, auto-fetch profile
          fetchGithubUser(config.github_token);
        }
      } catch (error) {
        logger.error(`設定の読み込みに失敗したよ: ${error}`);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Save settings to AppConfig when they change
  useEffect(() => {
    if (!isLoaded) return;
    const save = async () => {
      try {
        await updateAppConfig({
          settings_save_behavior: saveBehavior,
          settings_auto_scan: autoScan,
          settings_theme: theme,
        });
        document.documentElement.setAttribute("data-theme", theme);
        logger.info(`設定を一括保存したよ: theme=${theme}, behavior=${saveBehavior}, autoScan=${autoScan}`);
      } catch (error) {
        logger.error(`設定の一括保存に失敗したよ: ${error}`);
      }
    };
    save();
  }, [saveBehavior, autoScan, theme, isLoaded]);

  // Accessibility: Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        logger.debug("Escapeキーで設定モーダルを閉じるよ");
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      logger.debug("設定モーダルを開いたよ");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCliImport = async () => {
    setIsVerifying(true);
    setGithubError(null);
    try {
      logger.info("GitHub CLIからのトークン自動インポートをトリガーします");
      const token = await invoke<string>("github_import_cli_token");
      setGithubToken(token);
      await fetchGithubUser(token);
      logger.info("GitHub CLIからトークンをインポートしました。");
    } catch (err) {
      logger.error(`GitHub CLIインポートに失敗しました: ${err}`);
      setGithubError(typeof err === "string" ? err : t("settings.github.invalid_token_error"));
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePatConnect = async () => {
    if (!patInput.trim()) {
      setGithubError(t("settings.github.input_token_error"));
      return;
    }
    const token = patInput.trim();
    setGithubToken(token);
    await fetchGithubUser(token);
    setPatInput("");
    setShowPatInput(false);
  };

  const handleGithubDisconnect = async () => {
    setGithubToken(null);
    setGithubUsername(null);
    setGithubAvatar(null);
    setGithubError(null);
    await updateAppConfig({
      github_token: null,
      github_username: null,
    });
    logger.info("GitHubの連携を解除しました。");
  };

  const handleLanguageChange = async (lng: string) => {
    logger.info(`言語を切り替えます: ${lng}`);
    await i18n.changeLanguage(lng);
    logger.debug(`言語の切り替えが完了しました: ${i18n.language}`);
  };

  const handleRerunWizard = async () => {
    logger.info("環境診断ウィザードを再実行します");
    try {
      await updateAppConfig({ setup_completed: false });
      logger.debug("セットアップ完了フラグをリセットしました。アプリをリロードします。");
      window.location.reload();
    } catch (error) {
      logger.error(`環境診断ウィザードの再設定に失敗しました: ${error}`);
    }
  };

  const languages = [
    { code: "ja", name: "日本語" },
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "ko", name: "한국어" },
    { code: "th", name: "ไทย" },
    { code: "vi", name: "Tiếng Việt" },
    { code: "id", name: "Bahasa Indonesia" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "pt", name: "Português" },
    { code: "it", name: "Italiano" },
    { code: "ru", name: "Русский" },
    { code: "ar", name: "العربية" },
    { code: "hi", name: "हिन्दी" },
    { code: "et", name: "Eesti" },
    { code: "nl", name: "Nederlands" },
    { code: "pl", name: "Polski" },
    { code: "sv", name: "Svenska" },
  ];

  return (
    <div
      className="settings-modal-overlay"
      onClick={() => {
        logger.debug("オーバーレイクリックで設定モーダルを閉じるよ");
        onClose();
      }}
      role="presentation"
    >
      <div
        className="settings-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-modal-header">
          <h2 id="settings-title">
            <Settings2 size={20} />
            {t("common.sidebar.settings")}
          </h2>
          <button
            className="close-btn"
            onClick={() => {
              logger.debug("閉じるボタンで設定モーダルを閉じるよ");
              onClose();
            }}
            aria-label={t("common.action.close")}
          >
            <X size={20} />
          </button>
        </header>

        <div className="settings-modal-body">
          {/* 1. ユーザー連携 */}
          <section className="settings-section">
            <h3>
              <GitBranch size={16} />
              {t("settings.github.title") || "GitHub 連携"}
            </h3>
            
            {githubToken ? (
              <div className="github-account-card">
                <div className="github-account-info">
                  {githubAvatar ? (
                    <img src={githubAvatar} alt="Avatar" className="github-avatar" />
                  ) : (
                    <div className="github-avatar-placeholder">
                      <Github size={20} />
                    </div>
                  )}
                  <div className="github-account-details">
                    <span className="github-username">{githubUsername || t("settings.github.connected")}</span>
                    <span className="github-status">
                      <Check size={12} className="status-icon-check" />
                      {t("settings.github.connected")}
                    </span>
                  </div>
                </div>
                <button className="github-disconnect-btn" onClick={handleGithubDisconnect}>
                  <LogOut size={14} />
                  {t("settings.github.disconnect")}
                </button>
              </div>
            ) : (
              <div className="github-connect-container">
                <p className="github-desc">
                  {t("settings.github.desc") || "リポジトリの同期やバックアップ機能を利用するために必要です。"}
                </p>
                
                <div className="github-action-buttons">
                  <button
                    className="github-connect-btn cli-import-btn"
                    onClick={handleCliImport}
                    disabled={isVerifying}
                  >
                    <Github size={16} />
                    {isVerifying ? t("settings.github.verifying") : t("settings.github.cli_import")}
                  </button>

                  <button
                    className="github-connect-btn pat-toggle-btn"
                    onClick={() => setShowPatInput(!showPatInput)}
                    disabled={isVerifying}
                  >
                    <ShieldCheck size={16} />
                    {t("settings.github.pat_toggle")}
                  </button>
                </div>

                {showPatInput && (
                  <div className="pat-input-form">
                    <input
                      type="password"
                      placeholder={t("settings.github.pat_placeholder") || "GitHub Personal Access Token (ghp_...)"}
                      className="settings-select pat-input"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                    />
                    <button className="pat-submit-btn" onClick={handlePatConnect} disabled={isVerifying}>
                      {t("settings.github.connect_btn")}
                    </button>
                  </div>
                )}
              </div>
            )}
            {githubError && (
              <p className="github-error-msg">{githubError}</p>
            )}
          </section>

          {/* 2. テーマ設定 */}
          <section className="settings-section">
            <h3>
              <Palette size={16} />
              {t("settings.theme.title")}
            </h3>
            <div className="settings-control">
              <label htmlFor="theme-select">{t("settings.theme.select")}</label>
              <select
                id="theme-select"
                className="settings-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                <option value="light">{t("settings.theme.light")}</option>
                <option value="dark">{t("settings.theme.dark")}</option>
              </select>
            </div>
          </section>

          {/* 3. 言語設定 */}
          <section className="settings-section">
            <h3>
              <Languages size={16} />
              {t("settings.language.title")}
            </h3>
            <div className="settings-control">
              <label htmlFor="language-select">{t("settings.language.select")}</label>
              <select
                id="language-select"
                className="settings-select"
                value={i18n.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* 4. アプリ挙動 */}
          <section className="settings-section">
            <h3>
              <Cpu size={16} />
              {t("settings.behavior.title")}
            </h3>
            <div className="settings-control">
              <label>{t("settings.behavior.save_label")}</label>
              <div className="radio-group" role="radiogroup">
                <label className="radio-label">
                  <input
                    type="radio" 
                    name="save-behavior"
                    checked={saveBehavior === "confirm"}
                    onChange={() => setSaveBehavior("confirm")}
                  />
                  {t("settings.behavior.confirm")}
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="save-behavior"
                    checked={saveBehavior === "auto"}
                    onChange={() => setSaveBehavior("auto")}
                  />
                  {t("settings.behavior.auto")}
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="save-behavior"
                    checked={saveBehavior === "none"}
                    onChange={() => setSaveBehavior("none")}
                  />
                  {t("settings.behavior.none")}
                </label>
              </div>
            </div>
          </section>

          {/* 5. セキュリティ */}
          <section className="settings-section">
            <h3>
              <ShieldCheck size={16} />
              {t("settings.security.title")}
            </h3>
            <div className="toggle-row">
              <div className="settings-control">
                <label htmlFor="auto-scan-toggle" style={{ fontWeight: 600 }}>{t("settings.security.auto_scan")}</label>     
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t("settings.security.auto_scan_desc")}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  id="auto-scan-toggle"
                  type="checkbox"
                  checked={autoScan}
                  onChange={(e) => setAutoScan(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </section>

          {/* 6. 環境診断 */}
          <section className="settings-section">
            <h3>
              <Cpu size={16} />
              {t("settings.setup.title")}
            </h3>
            <div className="settings-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="github-connect-btn"
                style={{ backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: 'fit-content' }}
                onClick={handleRerunWizard}
              >
                <Cpu size={20} />
                {t("settings.setup.rerun_btn")}
              </button>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {t("settings.setup.desc")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
