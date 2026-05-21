import { type FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, GitBranch, Languages, Settings2, ShieldCheck, Cpu, Palette } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import logger from "../../utils/logger";
import { getAppConfig, updateAppConfig } from "../../api/config";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SaveBehavior = "confirm" | "auto" | "none";
type Theme = "light" | "dark";

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

  const handleGithubConnect = async () => {
    logger.info("GitHub連携を開始するよ");
    // 実際の実装ではClient IDなどを指定するが、今回は基盤実装としてGitHub認証ページを開く
    const clientId = "YOUR_GITHUB_CLIENT_ID"; // 本来は環境変数等から取得
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,user`;
    try {
      await open(authUrl);
      logger.debug(`GitHub認証URLを開いたよ: ${authUrl}`);
    } catch (error) {
      logger.error(`ブラウザを開くのに失敗したよ: ${error}`);
    }
  };

  const handleLanguageChange = async (lng: string) => {
    logger.info(`言語を切り替えるよ: ${lng}`);
    await i18n.changeLanguage(lng);
    logger.debug(`言語の切り替えが完了したよ: ${i18n.language}`);
  };

  const handleRerunWizard = async () => {
    logger.info("環境診断ウィザードを再実行するよ");
    try {
      await updateAppConfig({ setup_completed: false });
      logger.debug("セットアップ完了フラグをリセットしたよ。アプリをリロードします。");
      window.location.reload();
    } catch (error) {
      logger.error(`環境診断ウィザードの再設定に失敗したよ: ${error}`);
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
              {t("settings.github.title")}
            </h3>
            <div className="settings-row">
              <button
                className="github-connect-btn"
                onClick={handleGithubConnect}
              >
                <GitBranch size={20} />
                {t("settings.github.login")}
              </button>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {t("settings.github.desc")}
              </p>
            </div>
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
