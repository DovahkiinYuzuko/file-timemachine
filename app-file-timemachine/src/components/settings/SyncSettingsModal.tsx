import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, GitFork, Link2, Plus, Info, Globe, Lock, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import "./SyncSettingsModal.css";

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderPath: string;
  githubToken: string;
  onSuccess: (remoteUrl: string) => void;
}

type TabType = "create" | "link";

export const SyncSettingsModal: FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  currentFolderPath,
  githubToken,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("create");
  
  // 新規作成用フォーム
  const [repoName, setRepoName] = useState("");
  const [repoDesc, setRepoDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [topicsInput, setTopicsInput] = useState("");

  // 既存紐付け用フォーム
  const [existingUrl, setExistingUrl] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 新規リポジトリ作成 ＆ 紐付け
  const handleCreateAndLink = async () => {
    if (!repoName.trim()) {
      setErrorMsg(t("settings.sync.err_repo_name_required"));
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    logger.info(`GitHub上に新規リポジトリを作成します: ${repoName}`);

    try {
      // 1. GitHub APIでリポジトリを作成
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName.trim(),
          description: repoDesc.trim(),
          private: isPrivate,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.message || t("settings.sync.err_repo_create_failed"));
      }

      const repoData = await createRes.json();
      const cloneUrl = repoData.clone_url;
      const owner = repoData.owner.login;
      const name = repoData.name;

      logger.info(`リポジトリが作成されました: ${cloneUrl}`);

      // 2. トピックスがあれば設定する
      if (topicsInput.trim()) {
        const topics = topicsInput
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        if (topics.length > 0) {
          logger.info(`トピックスを設定します: ${topics.join(", ")}`);
          await fetch(`https://api.github.com/repos/${owner}/${name}/topics`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github.mercy-preview+json", // Topics API用のプレビューヘッダー
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ names: topics }),
          });
        }
      }

      // 3. ローカルGitにリモートを設定
      await invoke("git_set_remote", {
        path: currentFolderPath,
        remoteUrl: cloneUrl,
      });

      logger.info("新規リポジトリの紐付けが完了したよ！");
      onSuccess(cloneUrl);
      onClose();
    } catch (err: any) {
      logger.error(`新規リポジトリの作成・紐付けエラー: ${err}`);
      setErrorMsg(err.message || t("settings.sync.err_default"));
    } finally {
      setIsLoading(false);
    }
  };

  // 既存リポジトリ紐付け
  const handleLinkExisting = async () => {
    if (!existingUrl.trim()) {
      setErrorMsg(t("settings.sync.err_remote_url_required"));
      return;
    }

    // 簡単なGit URLのバリデーション
    if (!existingUrl.startsWith("https://") && !existingUrl.startsWith("git@")) {
      setErrorMsg(t("settings.sync.err_invalid_git_url"));
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    logger.info(`既存リポジトリを紐付けます: ${existingUrl}`);

    try {
      await invoke("git_set_remote", {
        path: currentFolderPath,
        remoteUrl: existingUrl.trim(),
      });

      logger.info("既存リポジトリの紐付けが完了したよ！");
      onSuccess(existingUrl.trim());
      onClose();
    } catch (err: any) {
      logger.error(`既存リポジトリの紐付けエラー: ${err}`);
      setErrorMsg(err.message || t("settings.sync.err_remote_set_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sync-modal-overlay" onClick={onClose} role="presentation">
      <div className="sync-modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sync-title">
        <header className="sync-modal-header">
          <h2 id="sync-title">
            <GitFork size={20} />
            {t("settings.sync.title")}
          </h2>
          <button className="sync-close-btn" onClick={onClose} aria-label={t("common.action.close")}>
            <X size={20} />
          </button>
        </header>

        <div className="sync-modal-tabs">
          <button
            className={`sync-tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("create");
              setErrorMsg(null);
            }}
          >
            <Plus size={16} />
            {t("settings.sync.tab_create")}
          </button>
          <button
            className={`sync-tab ${activeTab === "link" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("link");
              setErrorMsg(null);
            }}
          >
            <Link2 size={16} />
            {t("settings.sync.tab_link")}
          </button>
        </div>

        <div className="sync-modal-body">
          {errorMsg && (
            <div className="sync-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === "create" ? (
            <div className="sync-form-pane">
              <p className="sync-form-info">
                <Info size={14} />
                {t("settings.sync.info_create_desc")}
              </p>
              
              <div className="sync-field-group">
                <label htmlFor="repo-name">{t("settings.sync.label_repo_name")} <span className="required-star">*</span></label>
                <input
                  id="repo-name"
                  type="text"
                  placeholder="例: my-awesome-project"
                  className="sync-input"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="sync-field-group">
                <label htmlFor="repo-desc">{t("settings.sync.label_desc")}</label>
                <input
                  id="repo-desc"
                  type="text"
                  placeholder={t("settings.sync.placeholder_desc")}
                  className="sync-input"
                  value={repoDesc}
                  onChange={(e) => setRepoDesc(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="sync-field-group">
                <label>{t("settings.sync.label_privacy")}</label>
                <div className="sync-privacy-toggle">
                  <button
                    type="button"
                    className={`privacy-btn ${isPrivate ? "active" : ""}`}
                    onClick={() => setIsPrivate(true)}
                    disabled={isLoading}
                  >
                    <Lock size={16} />
                    <span>{t("settings.sync.btn_private")}</span>
                  </button>
                  <button
                    type="button"
                    className={`privacy-btn ${!isPrivate ? "active" : ""}`}
                    onClick={() => setIsPrivate(false)}
                    disabled={isLoading}
                  >
                    <Globe size={16} />
                    <span>{t("settings.sync.btn_public")}</span>
                  </button>
                </div>
              </div>

              <div className="sync-field-group">
                <label htmlFor="repo-topics">{t("settings.sync.label_topics")}</label>
                <input
                  id="repo-topics"
                  type="text"
                  placeholder={t("settings.sync.placeholder_topics")}
                  className="sync-input"
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <button
                className="sync-submit-btn"
                onClick={handleCreateAndLink}
                disabled={isLoading}
              >
                {isLoading ? t("settings.sync.btn_creating") : t("settings.sync.btn_create_submit")}
              </button>
            </div>
          ) : (
            <div className="sync-form-pane">
              <p className="sync-form-info">
                <Info size={14} />
                {t("settings.sync.info_link_desc")}
              </p>

              <div className="sync-field-group">
                <label htmlFor="existing-url">{t("settings.sync.label_remote_url")}</label>
                <input
                  id="existing-url"
                  type="text"
                  placeholder={t("settings.sync.placeholder_remote_url")}
                  className="sync-input"
                  value={existingUrl}
                  onChange={(e) => setExistingUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <button
                className="sync-submit-btn"
                onClick={handleLinkExisting}
                disabled={isLoading}
              >
                {isLoading ? t("settings.sync.btn_linking") : t("settings.sync.btn_link_submit")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
