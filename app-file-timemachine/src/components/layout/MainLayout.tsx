import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Save, Loader2 } from "lucide-react";
import Sidebar, { type SidebarTab } from "./Sidebar";
import FileTree from "../tree/FileTree";
import FilePreview from "../preview/FilePreview";
import HistoryList from "../history/HistoryList";
import GitGraph from "../graph/GitGraph";
import SafetyDialog from "../guard/SafetyDialog";
import SettingsModal from "../settings/SettingsModal";
import HelpModal from "../help/HelpModal";
import CommitMessageModal from "../common/CommitMessageModal";
import Tooltip from "../common/Tooltip";
import logger from "../../utils/logger";
import { analyzeFilesForSafety, type SafetyIssue } from "../../utils/safety";
import { invoke } from "@tauri-apps/api/core";
import "./MainLayout.css";

/**
 * Accessibility Strategy:
 * - Use <main> tag for the primary layout container.
 * - Sidebar uses <nav> for navigation landmarks.
 * - Each resizable panel uses a <section> with an aria-label.
 * - Vertical PanelGroup used in the middle column for combined Route and History view.
 * - PanelResizeHandle provides visual and keyboard-accessible resizing.
 * - Screen reader announcements for safety dialog.
 * - SettingsModal for app configuration.
 * - HelpModal for Git command cheat sheet.
 * - Tooltips for context-sensitive Git explanations.
 */

const MainLayout: FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [safetyIssues, setSafetyIssues] = useState<SafetyIssue[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [defaultCommitMessage, setDefaultCommitMessage] = useState("");

  // フォルダ選択時の処理
  const handleOpenFolder = (path: string) => {
    logger.info(`フォルダを選択したよ: ${path}`);
    setProjectPath(path);
  };

  // Gitコミットを実際に実行する処理
  const executeCommit = async (message: string) => {
    if (!projectPath) {
      logger.error("プロジェクトパスが設定されていないよ");
      alert("フォルダが開かれていないため、保存できません。");
      return;
    }

    setIsCommitting(true);
    try {
      logger.info(`Gitコミットを実行中... パス: ${projectPath}, メッセージ: "${message}"`);
      const result = await invoke<string>("git_commit", {
        path: projectPath,
        message: message,
      });
      logger.info(`コミット完了！結果: ${result}`);
      
      // コミットが完了したら、GitGraphとHistoryListを最新化させるためにリフレッシュキーを更新
      setHistoryRefreshKey((prev) => prev + 1);
      
      // 成功通知アラート
      alert(`タイムマシンに新しく記録したよ！\nメッセージ: "${message}"`);
    } catch (error) {
      logger.error(`Gitコミットに失敗したよ: ${error}`);
      alert(`保存に失敗しちゃった： ${error}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // 脆弱性スキャンをパスした、または無視して進む場合のコミット・保存処理
  const proceedToSaveOrCommit = () => {
    const saveBehavior = localStorage.getItem("settings_save_behavior") || "confirm";

    const now = new Date();
    // YYYY-MM-DD HH:mm 形式でフォーマットする
    const pad = (n: number) => String(n).padStart(2, "0");
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const defaultMsg = `${formattedDate} の保存`;

    if (saveBehavior === "none") {
      logger.info("保存設定が 'none' のため、Gitコミットはスキップするよ");
      alert("ローカルに保存したよ！（タイムマシンへの記録はスキップしたよ）");
      setHistoryRefreshKey(prev => prev + 1);
      return;
    }

    if (saveBehavior === "auto") {
      logger.info("保存設定が 'auto' なので自動コミットを実行するよ");
      executeCommit(defaultMsg);
    } else {
      logger.debug("保存設定が 'confirm' なのでコミットメッセージ入力モーダルを開くよ");
      setDefaultCommitMessage(defaultMsg);
      setIsCommitModalOpen(true);
    }
  };

  // 保存ボタンが押された時の処理
  const handleSaveClick = () => {
    if (!projectPath) {
      logger.warn("プロジェクトフォルダが選択されていない状態で保存ボタンが押されたよ");
      alert("フォルダが開かれていないよ！タイムマシンに保存するには、まず左のサイドバーからフォルダを開いてね");
      return;
    }

    logger.info("保存ボタンが押されたよ。安全スキャンを開始するね");
    const isAutoScanEnabled = localStorage.getItem("settings_auto_scan") !== "false";

    if (isAutoScanEnabled) {
      logger.debug("自動脆弱性スキャンが有効だよ");
      // デモ用のモックファイルデータ
      const mockFiles = [
        { path: "src/App.tsx", size: 1024 },
        { path: ".env", size: 100 },
        { path: "node_modules/react/index.js", size: 5000 },
        { path: "assets/large_video.mp4", size: 150 * 1024 * 1024 },
        { path: "secrets.pem", size: 2048 },
      ];

      const issues = analyzeFilesForSafety(mockFiles);

      if (issues.length > 0) {
        logger.warn(`${issues.length} 件のセキュリティリスクが見つかったよ！`);
        setSafetyIssues(issues);
        setIsSafetyDialogOpen(true);
        return;
      }
      logger.debug("リスクは見つからなかったよ。クリーンだね！");
    }

    // スキャンクリアならコミットに進む
    proceedToSaveOrCommit();
  };

  const handleTabChange = (tab: SidebarTab) => {
    logger.debug(`サイドバーのアクションを受け取ったよ: ${tab}`);
    if (tab === "settings") {
      setIsSettingsModalOpen(true);
    } else if (tab === "help") {
      setIsHelpModalOpen(true);
    } else {
      logger.info(`アクティブなタブを切り替えるよ: ${tab}`);
      setActiveTab(tab);
    }
  };

  const handleSettingsClose = () => {
    logger.debug("設定モーダルを閉じるよ");
    setIsSettingsModalOpen(false);
  };

  const handleHelpClose = () => {
    logger.debug("ヘルプモーダルを閉じるよ");
    setIsHelpModalOpen(false);
  };

  return (
    <div className="layout-wrapper">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        onOpenFolder={handleOpenFolder} 
      />
      
      <div className="layout-main-content">
        <main className="main-layout-container" aria-label={t("common.app_title")}>
          <PanelGroup orientation="horizontal">
            {/* 1. ファイルツリーパネル（左）：Filesタブの時のみ表示 */}
            {activeTab === "files" && (
              <>
                <Panel defaultSize={25} minSize={20}>
                  <section className="panel-content" aria-label={t("common.file_tree")}>
                    <header className="panel-header">
                      <h2>{t("common.file_tree")}</h2>
                    </header>
                    <div className="panel-body">
                      <FileTree 
                        rootPath={projectPath} 
                        onFileSelect={(path) => {
                          logger.debug(`ファイルが選択されたよ: ${path}`);
                          setSelectedFilePath(path);
                        }}
                      />
                    </div>
                  </section>
                </Panel>
                <PanelResizeHandle className="resize-handle" />
              </>
            )}

            {/* 2. 履歴・ルート管理パネル（中央：上下分割）：Historyタブの時のみ表示 */}
            {activeTab === "history" && (
              <>
                <Panel defaultSize={40} minSize={30}>
                  <PanelGroup orientation="vertical">
                    {/* 上段：GitGraph */}
                    <Panel defaultSize={50} minSize={20}>
                      <section className="panel-content" aria-label={t("common.root_management")}>
                        <header className="panel-header">
                          <h2>
                            {t("common.root_management")}
                            <Tooltip content={t("tooltip.root_management")} />
                          </h2>
                        </header>
                        <div className="panel-body">
                          <GitGraph 
                            projectPath={projectPath} 
                            refreshKey={historyRefreshKey}
                            onInitSuccess={() => setHistoryRefreshKey(prev => prev + 1)}
                          />
                        </div>
                      </section>
                    </Panel>

                    <PanelResizeHandle className="resize-handle-vertical" />

                    {/* 下段：履歴リスト */}
                    <Panel defaultSize={50} minSize={20}>
                      <section className="panel-content" aria-label={t("common.history_list")}>
                        <header className="panel-header">
                          <h2>
                            {t("common.history_list")}
                            <Tooltip content={t("tooltip.history_list")} />
                          </h2>
                        </header>
                        <div className="panel-body">
                          <HistoryList projectPath={projectPath} refreshKey={historyRefreshKey} />
                        </div>
                      </section>
                    </Panel>
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle className="resize-handle" />
              </>
            )}

            {/* 3. プレビューパネル（右）：常に表示 */}
            <Panel defaultSize={activeTab === "files" ? 75 : 60} minSize={30}>
              <section className="panel-content" aria-label={t("common.preview")}>
                <header className="panel-header">
                  <h2>{t("common.preview")}</h2>
                </header>
                <div className="panel-body">
                  <FilePreview filePath={selectedFilePath} />
                </div>
              </section>
            </Panel>
          </PanelGroup>
        </main>

        <footer className="main-footer" role="contentinfo">
          <div className="footer-actions">
            <button 
              className="save-state-btn" 
              onClick={handleSaveClick}
              disabled={isCommitting}
              aria-haspopup="dialog"
            >
              {isCommitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save size={18} aria-hidden="true" />
                  <span>{t("help.commands.save.op")}</span>
                </>
              )}
            </button>
            <Tooltip content={t("tooltip.save_button")} />
          </div>
        </footer>
      </div>


      <SafetyDialog
        isOpen={isSafetyDialogOpen}
        issues={safetyIssues}
        onClose={() => setIsSafetyDialogOpen(false)}
        onConfirmAnyway={() => {
          setIsSafetyDialogOpen(false);
          logger.info("脆弱性スキャンを無視して強引に保存するよ");
          proceedToSaveOrCommit();
        }}
        onConfirmExclude={() => {
          setIsSafetyDialogOpen(false);
          logger.info("ヤバいファイルを除いて保存するよ");
          proceedToSaveOrCommit();
        }}
      />

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={handleSettingsClose}
      />

      <HelpModal 
        isOpen={isHelpModalOpen}
        onClose={handleHelpClose}
      />

      <CommitMessageModal
        isOpen={isCommitModalOpen}
        onClose={() => setIsCommitModalOpen(false)}
        onSave={(msg) => {
          setIsCommitModalOpen(false);
          executeCommit(msg);
        }}
        defaultMessage={defaultCommitMessage}
      />
    </div>
  );
};

export default MainLayout;
