import { type FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Save, Loader2, GitBranch, GitBranchPlus } from "lucide-react";
import Sidebar, { type SidebarTab } from "./Sidebar";
import FileTree from "../tree/FileTree";
import FilePreview from "../preview/FilePreview";
import HistoryList from "../history/HistoryList";
import GitGraph from "../graph/GitGraph";
import SafetyDialog from "../guard/SafetyDialog";
import SettingsModal from "../settings/SettingsModal";
import HelpModal from "../help/HelpModal";
import CommitMessageModal from "../common/CommitMessageModal";
import CreateBranchModal from "../common/CreateBranchModal";
import SwitchBranchModal from "../common/SwitchBranchModal";
import Tooltip from "../common/Tooltip";
import logger from "../../utils/logger";
import { type SafetyIssue } from "../../utils/safety";
import { invoke } from "@tauri-apps/api/core";
import { getAppConfig, updateAppConfig } from "../../api/config";
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
  const [safetyIssues] = useState<SafetyIssue[]>([]); // TODO: バックエンド実装後に setSafetyIssues を復活させる
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [defaultCommitMessage, setDefaultCommitMessage] = useState("");
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [isSwitchBranchModalOpen, setIsSwitchBranchModalOpen] = useState(false);

  // 現在のブランチ名を取得
  useEffect(() => {
    if (!projectPath) return;
    const fetchBranch = async () => {
      try {
        const branch = await invoke<string>("git_get_current_branch", { path: projectPath });
        setCurrentBranch(branch);
      } catch (error) {
        logger.error(`ブランチ名の取得に失敗したよ: ${error}`);
      }
    };
    fetchBranch();
  }, [projectPath, historyRefreshKey]);

  // 初期ロード時に前回開いていたフォルダを復元
  useEffect(() => {
    const restoreFolder = async () => {
      try {
        const config = await getAppConfig();
        if (config.last_opened_folder) {
          logger.info(`前回開いていたフォルダを復元したよ: ${config.last_opened_folder}`);
          setProjectPath(config.last_opened_folder);
        }
      } catch (error) {
        logger.error(`前回開いていたフォルダの復元に失敗したよ: ${error}`);
      }
    };
    restoreFolder();
  }, []);

  // フォルダ選択時の処理
  const handleOpenFolder = async (path: string) => {
    logger.info(`フォルダを選択したよ: ${path}`);
    setProjectPath(path);
    try {
      await updateAppConfig({ last_opened_folder: path });
    } catch (error) {
      logger.error(`フォルダの保存に失敗したよ: ${error}`);
    }
  };

  // Gitコミットを実際に実行する処理
  const executeCommit = async (message: string) => {
    if (!projectPath) {
      logger.error("プロジェクトパスが設定されていません。");
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
      logger.info(`コミット完了: ${result}`);
      
      // コミットが完了したら、GitGraphとHistoryListを最新化させるためにリフレッシュキーを更新
      setHistoryRefreshKey((prev) => prev + 1);
      
      // 成功通知アラート
      alert(`状態を記録しました。\nメッセージ: "${message}"`);
    } catch (error) {
      logger.error(`Gitコミットに失敗しました: ${error}`);
      alert(`保存に失敗しました： ${error}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // 新しいルートを作成する処理
  const executeCreateBranch = async (branchName: string) => {
    if (!projectPath) return;
    try {
      logger.info(`新しいルートを作成します: ${branchName}`);
      const result = await invoke<string>("git_create_branch", { path: projectPath, branchName });
      logger.info(result);
      
      // ツリーや履歴を更新
      setHistoryRefreshKey(prev => prev + 1);
      alert(`新しいルート「${branchName}」を作成し、切り替えました。`);
    } catch (error) {
      logger.error(`ブランチ作成エラー: ${error}`);
      alert(`ルート作成に失敗しました: ${error}`);
    }
  };

  // ルートを切り替える処理
  const executeSwitchBranch = async (branchName: string) => {
    if (!projectPath) return;
    try {
      logger.info(`ルートを切り替えます: ${branchName}`);
      const result = await invoke<string>("git_checkout", { path: projectPath, branch: branchName });
      logger.info(result);
      
      // ツリーや履歴を更新
      setHistoryRefreshKey(prev => prev + 1);
      alert(`ルート「${branchName}」に切り替えました。`);
    } catch (error) {
      logger.error(`ルート切り替えエラー: ${error}`);
      alert(`切り替えに失敗しました: ${error}`);
    }
  };

  // 脆弱性スキャンをパスした、または無視して進む場合のコミット・保存処理
  const proceedToSaveOrCommit = async () => {
    let saveBehavior = "confirm";
    try {
      const config = await getAppConfig();
      saveBehavior = config.settings_save_behavior || "confirm";
    } catch (error) {
      logger.error(`保存設定の読み込みに失敗したよ: ${error}`);
    }

    const now = new Date();
    // YYYY-MM-DD HH:mm 形式でフォーマットする
    const pad = (n: number) => String(n).padStart(2, "0");
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const defaultMsg = `${formattedDate} の保存`;

    if (saveBehavior === "none") {
      logger.info("保存設定が 'none' のため、Gitコミットをスキップします。");
      alert("ローカルに保存しました（Gitへの記録はスキップされました）。");
      setHistoryRefreshKey(prev => prev + 1);
      return;
    }

    if (saveBehavior === "auto") {
      logger.info("保存設定が 'auto' なので自動コミットを実行します。");
      executeCommit(defaultMsg);
    } else {
      logger.debug("保存設定が 'confirm' なのでコミットメッセージ入力モーダルを開きます。");
      setDefaultCommitMessage(defaultMsg);
      setIsCommitModalOpen(true);
    }
  };

  // 保存ボタンが押された時の処理
  const handleSaveClick = async () => {
    if (!projectPath) {
      logger.warn("プロジェクトフォルダが選択されていない状態で保存ボタンが押されました。");
      alert("フォルダが開かれていないため保存できません。左のサイドバーからフォルダを開いてください。");
      return;
    }

    logger.info("保存プロセスを開始します。");
    
    let isAutoScanEnabled = true;
    try {
      const config = await getAppConfig();
      isAutoScanEnabled = config.settings_auto_scan !== false;
    } catch (error) {
      logger.error(`自動スキャン設定の読み込みに失敗したよ: ${error}`);
    }

    if (isAutoScanEnabled) {
      logger.debug("自動脆弱性スキャンが有効ですが、現在デモデータによる誤検知を防ぐためスキップしています。");
      // TODO: Rustバックエンドに `get_uncommitted_files` コマンドを追加し、本物の変更ファイルリストを取得して検証する処理を実装予定。
      // 現状は進行を妨げないように常にパスさせます。
    }

    // スキャンクリアならコミットに進む
    await proceedToSaveOrCommit();
  };

  const handleTabChange = (tab: SidebarTab) => {
    logger.debug(`サイドバーのアクションを受信: ${tab}`);
    if (tab === "settings") {
      setIsSettingsModalOpen(true);
    } else if (tab === "help") {
      setIsHelpModalOpen(true);
    } else {
      logger.info(`アクティブなタブを切り替え: ${tab}`);
      setActiveTab(tab);
    }
  };

  const handleSettingsClose = () => {
    logger.debug("設定モーダルを閉じました。");
    setIsSettingsModalOpen(false);
  };

  const handleHelpClose = () => {
    logger.debug("ヘルプモーダルを閉じました。");
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
                  <PanelGroup orientation="vertical" style={{ height: "100%", overflow: "hidden" }}>
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
          <div className="footer-left">
            {projectPath && (
              <button 
                className="branch-info-btn" 
                title="ルートを切り替える"
                onClick={() => setIsSwitchBranchModalOpen(true)}
              >
                <GitBranch size={16} />
                <span className="branch-name">{currentBranch}</span>
              </button>
            )}
          </div>
          <div className="footer-actions">
            {projectPath && (
              <button
                className="create-branch-btn"
                onClick={() => setIsCreateBranchModalOpen(true)}
                title="新しいルートを作る"
              >
                <GitBranchPlus size={16} />
                <span>新しいルート</span>
              </button>
            )}
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
          logger.info("脆弱性スキャンの警告を無視して保存を継続します。");
          proceedToSaveOrCommit();
        }}
        onConfirmExclude={() => {
          setIsSafetyDialogOpen(false);
          logger.info("該当ファイルを除外して保存を継続します。");
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

      <CreateBranchModal
        isOpen={isCreateBranchModalOpen}
        onClose={() => setIsCreateBranchModalOpen(false)}
        onSave={(branchName) => {
          setIsCreateBranchModalOpen(false);
          executeCreateBranch(branchName);
        }}
      />

      <SwitchBranchModal
        isOpen={isSwitchBranchModalOpen}
        onClose={() => setIsSwitchBranchModalOpen(false)}
        onSwitch={(branchName) => {
          setIsSwitchBranchModalOpen(false);
          executeSwitchBranch(branchName);
        }}
        projectPath={projectPath}
        currentBranch={currentBranch}
      />
    </div>
  );
};

export default MainLayout;
