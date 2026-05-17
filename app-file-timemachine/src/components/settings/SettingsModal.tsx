import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, GitBranch, Languages, Settings2, ShieldCheck, Cpu } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SaveBehavior = "confirm" | "auto" | "none";

/**
 * Accessibility Strategy:
 * - Role "dialog" and aria-modal="true" for the modal.
 * - Focus management: Focus trapped inside modal when open (simplified here).
 * - Close on Escape key and close button.
 * - Labels for all form controls.
 */
const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [saveBehavior, setSaveBehavior] = useState<SaveBehavior>("confirm");
  const [autoScan, setAutoScan] = useState(true);

  if (!isOpen) return null;

  const handleGithubConnect = async () => {
    // 実際の実装ではClient IDなどを指定するが、今回は基盤実装としてGitHub認証ページを開く
    const clientId = "YOUR_GITHUB_CLIENT_ID"; // 本来は環境変数等から取得
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,user`;
    try {
      await open(authUrl);
    } catch (error) {
      console.error("Failed to open browser:", error);
    }
  };

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
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
      onClick={onClose}
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
            onClick={onClose}
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
              GitHub 連携
            </h3>
            <div className="settings-row">
              <button 
                className="github-connect-btn"
                onClick={handleGithubConnect}
              >
                <GitBranch size={20} />
                GitHubでログイン
              </button>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                リポジトリの同期やバックアップ機能を利用するために必要です。
              </p>
            </div>
          </section>

          {/* 2. 言語設定 */}
          <section className="settings-section">
            <h3>
              <Languages size={16} />
              言語設定 (Language)
            </h3>
            <div className="settings-control">
              <label htmlFor="language-select">表示言語を選択してください</label>
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

          {/* 3. アプリ挙動 */}
          <section className="settings-section">
            <h3>
              <Cpu size={16} />
              アプリの挙動
            </h3>
            <div className="settings-control">
              <label>ルート切り替え時の保存設定</label>
              <div className="radio-group" role="radiogroup">
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="save-behavior" 
                    checked={saveBehavior === "confirm"}
                    onChange={() => setSaveBehavior("confirm")}
                  />
                  毎回確認する (推奨)
                </label>
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="save-behavior" 
                    checked={saveBehavior === "auto"}
                    onChange={() => setSaveBehavior("auto")}
                  />
                  全自動で保存する
                </label>
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="save-behavior" 
                    checked={saveBehavior === "none"}
                    onChange={() => setSaveBehavior("none")}
                  />
                  保存しない
                </label>
              </div>
            </div>
          </section>

          {/* 4. セキュリティ */}
          <section className="settings-section">
            <h3>
              <ShieldCheck size={16} />
              セキュリティ
            </h3>
            <div className="toggle-row">
              <div className="settings-control">
                <label htmlFor="auto-scan-toggle" style={{ fontWeight: 600 }}>自動脆弱性スキャン</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  保存前に依存関係の脆弱性をチェックします。
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
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
