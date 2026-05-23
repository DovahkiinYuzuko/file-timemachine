import { type FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Save, Loader2, GitBranch, GitBranchPlus, GitMerge, RefreshCw } from "lucide-react";
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
import ConflictResolverModal from "../common/ConflictResolverModal";
import { SyncSettingsModal } from "../settings/SyncSettingsModal";
import Tooltip from "../common/Tooltip";
import logger from "../../utils/logger";
import { type SafetyIssue, analyzeFilesForSafety } from "../../utils/safety";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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
  const [safetyIssues, setSafetyIssues] = useState<SafetyIssue[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [defaultCommitMessage, setDefaultCommitMessage] = useState("");
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [isSwitchBranchModalOpen, setIsSwitchBranchModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);

  // クラウド同期用ステート
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [githubTokenForSync, setGithubTokenForSync] = useState<string | null>(null);


  // 現在のブランチ名を取得
  useEffect(() => {
    if (!projectPath) return;
    const fetchBranch = async () => {
      try {
        const branch = await invoke<string>("git_get_current_branch", { path: projectPath });
        setCurrentBranch(branch);
      } catch (error) {
        logger.error(`Failed to get branch name: ${error}`);
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
          logger.info(`Restored last opened folder: ${config.last_opened_folder}`);
          setProjectPath(config.last_opened_folder);
        }
      } catch (error) {
        logger.error(`Failed to restore last opened folder: ${error}`);
      }
    };
    restoreFolder();
  }, []);

  // フォルダ監視とファイル変更イベントの購読
  useEffect(() => {
    let unlistenFn: UnlistenFn | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const setupWatcher = async () => {
      if (!projectPath) {
        try {
          await invoke("stop_watching");
        } catch (e) {
          logger.error(`Failed to stop watcher: ${e}`);
        }
        return;
      }

      try {
        // バックエンドでの監視を開始
        await invoke("start_watching", { path: projectPath });
        logger.info(`Started directory watcher: ${projectPath}`);

        // イベント購読
        unlistenFn = await listen<any>("file-system-change", (event) => {
          logger.debug(`Received file system change event: ${JSON.stringify(event.payload)}`);
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(() => {
            logger.info("File changes detected. Automatically refreshing view.");
            setHistoryRefreshKey((prev) => prev + 1);
          }, 500); // 500ms デバウンスで十分な安全マージンを確保
        });
      } catch (error) {
        logger.error(`Failed to set up directory watcher: ${error}`);
      }
    };

    setupWatcher();

    // クリーンアップ処理
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      const cleanupWatcher = async () => {
        try {
          await invoke("stop_watching");
        } catch (e) {
          logger.error(`Failed to clean up watcher: ${e}`);
        }
      };
      cleanupWatcher();
    };
  }, [projectPath]);

  // フォルダ選択時の処理
  const handleOpenFolder = async (path: string) => {
    logger.info(`Folder selected: ${path}`);
    setProjectPath(path);
    try {
      await updateAppConfig({ last_opened_folder: path });
    } catch (error) {
      logger.error(`Failed to save folder path: ${error}`);
    }
  };

  // Gitコミットを実際に実行する処理
  const executeCommit = async (message: string) => {
    if (!projectPath) {
      logger.error("Project path is not set.");
      alert(t("layout.alert.no_folder_save"));
      return;
    }

    setIsCommitting(true);
    try {
      logger.info(`Executing Git commit... Path: ${projectPath}, Message: "${message}"`);
      const result = await invoke<string>("git_commit", {
        path: projectPath,
        message: message,
      });
      logger.info(`Commit completed: ${result}`);
      
      // コミットが完了したら、GitGraphとHistoryListを最新化させるためにリフレッシュキーを更新
      setHistoryRefreshKey((prev) => prev + 1);
      
      // 成功通知アラート
      alert(t("layout.alert.save_success", { message }));
    } catch (error) {
      logger.error(`Failed to execute Git commit: ${error}`);
      alert(t("layout.alert.save_failed", { error }));
    } finally {
      setIsCommitting(false);
    }
  };

  // 新しいルートを作成する処理
  const executeCreateBranch = async (branchName: string) => {
    if (!projectPath) return;
    try {
      logger.info(`Creating new route: ${branchName}`);
      const result = await invoke<string>("git_create_branch", { path: projectPath, branchName });
      logger.info(result);
      
      // ツリーや履歴を更新
      setHistoryRefreshKey(prev => prev + 1);
      alert(t("layout.alert.create_branch_success", { branchName }));
    } catch (error) {
      logger.error(`Failed to create branch: ${error}`);
      alert(t("layout.alert.create_branch_failed", { error }));
    }
  };

  // ルートを切り替える処理
  const executeSwitchBranch = async (branchName: string) => {
    if (!projectPath) return;
    try {
      logger.info(`Switching route: ${branchName}`);
      const result = await invoke<string>("git_checkout", { path: projectPath, branch: branchName });
      logger.info(result);
      
      // ツリーや履歴を更新
      setHistoryRefreshKey(prev => prev + 1);
      alert(t("layout.alert.switch_branch_success", { branchName }));
    } catch (error) {
      logger.error(`Failed to switch route: ${error}`);
      alert(t("layout.alert.switch_branch_failed", { error }));
    }
  };

  // 本番（main）にマージする処理
  const executeMergeToMain = async () => {
    if (!projectPath) return;

    // 確認ダイアログ
    if (!confirm(t("layout.confirm.merge"))) {
      return;
    }

    try {
      logger.info(`Starting merge to main: ${currentBranch} -> main`);
      const result = await invoke<string>("git_merge_to_main", {
        path: projectPath,
        branch: currentBranch,
      });
      logger.info(result);

      alert(t("layout.alert.merge_success"));
      setCurrentBranch("main");
      setHistoryRefreshKey((prev) => prev + 1);
    } catch (error) {
      if (error === "CONFLICT") {
        logger.warn("Merge conflict detected. Opening resolution modal.");
        setIsConflictModalOpen(true);
      } else {
        logger.error(`Merge error: ${error}`);
        alert(t("layout.alert.merge_failed", { error }));
      }
    }
  };

  // 脆弱性スキャンをパスした、または無視して進む場合のコミット・保存処理
  const proceedToSaveOrCommit = async () => {
    let saveBehavior = "confirm";
    try {
      const config = await getAppConfig();
      saveBehavior = config.settings_save_behavior || "confirm";
    } catch (error) {
      logger.error(`Failed to load save behavior settings: ${error}`);
    }

    const now = new Date();
    // YYYY-MM-DD HH:mm 形式でフォーマットする
    const pad = (n: number) => String(n).padStart(2, "0");
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const defaultMsg = t("layout.alert.default_commit_message", { date: formattedDate });

    if (saveBehavior === "none") {
      logger.info("Save behavior is 'none'. Skipping Git commit.");
      alert(t("layout.alert.save_local_only"));
      setHistoryRefreshKey(prev => prev + 1);
      return;
    }

    if (saveBehavior === "auto") {
      logger.info("Save behavior is 'auto'. Executing automatic commit.");
      executeCommit(defaultMsg);
    } else {
      logger.debug("Save behavior is 'confirm'. Opening commit message modal.");
      setDefaultCommitMessage(defaultMsg);
      setIsCommitModalOpen(true);
    }
  };

  // 脆弱性スキャンで検知されたファイルを除外して保存（.gitignoreに追加してコミット）
  const handleConfirmExclude = async () => {
    setIsSafetyDialogOpen(false);
    if (!projectPath) return;

    try {
      logger.info("Excluding targets and continuing save.");
      
      // プロジェクト設定から現在の git_mode を取得する
      const config = await invoke<{ git_mode: "whitelist" | "blacklist" }>("get_project_config", { rootPath: projectPath });
      const gitMode = config.git_mode;

      for (const issue of safetyIssues) {
        const fileAbsPath = `${projectPath}/${issue.path}`.replace(/\\/g, "/");
        const isDir = issue.reason === "inappropriate_directory";

        await invoke("update_gitignore", {
          rootPath: projectPath,
          targetPath: fileAbsPath,
          isIgnored: true,
          isDir,
          mode: gitMode
        });
      }

      logger.info("Exclusion process completed. Proceeding to commit.");
      await proceedToSaveOrCommit();
    } catch (error) {
      logger.error(`Failed to exclude files: ${error}`);
      alert(t("layout.alert.exclude_failed", { error }));
    }
  };

  // 保存ボタンが押された時の処理
  const handleSaveClick = async () => {
    if (!projectPath) {
      logger.warn("Save button clicked without folder path.");
      alert(t("layout.alert.no_folder_to_save"));
      return;
    }

    logger.info("Starting save process.");
    
    let isAutoScanEnabled = true;
    try {
      const config = await getAppConfig();
      isAutoScanEnabled = config.settings_auto_scan !== false;
    } catch (error) {
      logger.error(`Failed to load auto scan setting: ${error}`);
    }

    if (isAutoScanEnabled) {
      try {
        logger.info("Executing safety scan...");
        // Rustバックエンドから未コミットの変更ファイル一覧を取得
        const uncommittedFiles = await invoke<Array<{ path: string; size: number }>>("git_get_uncommitted_files", {
          path: projectPath
        });

        // 脆弱性・巨大ファイルを解析
        const issues = analyzeFilesForSafety(uncommittedFiles);

        if (issues.length > 0) {
          logger.warn(`Safety issues detected: ${issues.length}. Opening safety dialog.`);
          setSafetyIssues(issues);
          setIsSafetyDialogOpen(true);
          return; // 保存処理を一時停止し、ユーザーの入力を待つ
        }
        logger.info("Safety scan cleared.");
      } catch (error) {
        logger.error(`Error during safety scan. Skipping for safety: ${error}`);
      }
    }

    // スキャンクリアならコミットに進む
    await proceedToSaveOrCommit();
  };

  // クラウド同期処理の実行
  const executeSync = async (remoteUrl: string, token: string) => {
    if (!projectPath) return;
    setIsSyncing(true);
    logger.info(`Starting cloud sync: remote=${remoteUrl}, branch=${currentBranch}`);

    try {
      // 1. Git Pull
      logger.info("Executing Git pull...");
      await invoke("git_pull", {
        path: projectPath,
        token: token,
        branch: currentBranch,
      });
      logger.info("Git pull succeeded. Executing Git push.");

      // 2. Git Push
      logger.info("Executing Git push...");
      const pushRes = await invoke<string>("git_push", {
        path: projectPath,
        token: token,
        branch: currentBranch,
      });
      logger.info(`Git push succeeded: ${pushRes}`);

      setHistoryRefreshKey((prev) => prev + 1);
      alert(t("layout.alert.sync_success"));
    } catch (error) {
      if (error === "CONFLICT") {
        logger.warn("Conflict detected during pull. Launching resolver.");
        setIsConflictModalOpen(true);
      } else {
        logger.error(`Cloud sync error: ${error}`);
        alert(t("layout.alert.sync_failed", { error }));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncClick = async () => {
    if (!projectPath) {
      alert(t("layout.alert.sync_no_folder"));
      return;
    }

    try {
      const config = await getAppConfig();
      const token = config.github_token;
      
      if (!token) {
        logger.warn("GitHub sync token not found.");
        alert(t("layout.alert.sync_link_required"));
        setIsSettingsModalOpen(true);
        return;
      }

      setGithubTokenForSync(token);

      // リモート設定をチェック
      const remoteUrl = await invoke<string | null>("git_get_remote", { path: projectPath });
      if (!remoteUrl) {
        logger.info("Remote repository not configured. Opening sync settings.");
        setIsSyncSettingsOpen(true);
      } else {
        // 同期を実行
        await executeSync(remoteUrl, token);
      }
    } catch (error) {
      logger.error(`Error during sync preparation: ${error}`);
      alert(t("layout.alert.sync_prep_failed", { error }));
    }
  };

  const handleTabChange = (tab: SidebarTab) => {
    logger.debug(`Received sidebar action: ${tab}`);
    if (tab === "settings") {
      setIsSettingsModalOpen(true);
    } else if (tab === "help") {
      setIsHelpModalOpen(true);
    } else {
      logger.info(`Switching active tab: ${tab}`);
      setActiveTab(tab);
      if (tab === "files") {
        setSelectedCommitHash(null);
      }
    }
  };

  const handleSettingsClose = () => {
    logger.debug("Closed settings modal.");
    setIsSettingsModalOpen(false);
  };

  const handleHelpClose = () => {
    logger.debug("Closed help modal.");
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
                      <h2><span className="panel-title-text">{t("common.file_tree")}</span></h2>
                    </header>
                    <div className="panel-body">
                      <FileTree 
                        rootPath={projectPath} 
                        refreshKey={historyRefreshKey}
                        onFileSelect={(path) => {
                          logger.debug(`File selected: ${path}`);
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
                            <span className="panel-title-text">{t("common.root_management")}</span>
                            <Tooltip content={t("tooltip.root_management")} position="bottom" align="start" />
                          </h2>
                        </header>
                        <div className="panel-body">
                          <GitGraph 
                            projectPath={projectPath} 
                            refreshKey={historyRefreshKey}
                            onInitSuccess={() => setHistoryRefreshKey(prev => prev + 1)}
                            selectedCommitHash={selectedCommitHash}
                            onCommitSelect={setSelectedCommitHash}
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
                            <span className="panel-title-text">{t("common.history_list")}</span>
                            <Tooltip content={t("tooltip.history_list")} position="bottom" align="start" />
                          </h2>
                        </header>
                        <div className="panel-body">
                          <HistoryList 
                            projectPath={projectPath} 
                            refreshKey={historyRefreshKey} 
                            selectedCommitHash={selectedCommitHash}
                            onCommitSelect={setSelectedCommitHash}
                          />
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
                  <h2><span className="panel-title-text">{t("common.preview")}</span></h2>
                </header>
                <div className="panel-body">
                  <FilePreview 
                    filePath={selectedFilePath} 
                    projectPath={projectPath}
                    selectedCommitHash={selectedCommitHash}
                    onClearCommitSelect={() => setSelectedCommitHash(null)}
                  />
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
                title={t("layout.tooltip.switch_route")}
                onClick={() => setIsSwitchBranchModalOpen(true)}
              >
                <GitBranch size={16} />
                <span className="branch-name">{currentBranch}</span>
              </button>
            )}
          </div>
          <div className="footer-actions">
            {projectPath && currentBranch !== "main" && (
              <button
                className="merge-to-main-btn"
                onClick={executeMergeToMain}
                title={t("layout.tooltip.merge_to_main")}
              >
                <GitMerge size={16} />
                <span>{t("help.commands.merge.op")}</span>
              </button>
            )}
            {projectPath && (
              <button
                className="create-branch-btn"
                onClick={() => setIsCreateBranchModalOpen(true)}
                title={t("layout.tooltip.create_route")}
              >
                <GitBranchPlus size={16} />
                <span>{t("layout.action.new_route")}</span>
              </button>
            )}
            {projectPath && (
              <button
                className="sync-cloud-btn"
                onClick={handleSyncClick}
                disabled={isSyncing || isCommitting}
                title={t("help.commands.sync.desc")}
              >
                {isSyncing ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span>{t("help.commands.sync.op")}</span>
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
                  <span>{t("layout.action.saving")}</span>
                </>
              ) : (
                <>
                  <Save size={18} aria-hidden="true" />
                  <span>{t("help.commands.save.op")}</span>
                </>
              )}
            </button>
            <Tooltip content={t("tooltip.save_button")} position="top" align="end" />
          </div>
        </footer>
      </div>


      <SafetyDialog
        isOpen={isSafetyDialogOpen}
        issues={safetyIssues}
        onClose={() => setIsSafetyDialogOpen(false)}
        onConfirmAnyway={() => {
          setIsSafetyDialogOpen(false);
          logger.info("Ignoring safety scan warnings and continuing save.");
          proceedToSaveOrCommit();
        }}
        onConfirmExclude={handleConfirmExclude}
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
        onDeleted={() => setHistoryRefreshKey(prev => prev + 1)}
      />

      <ConflictResolverModal
        isOpen={isConflictModalOpen}
        projectPath={projectPath}
        onResolved={() => {
          setIsConflictModalOpen(false);
          alert(t("layout.alert.resolve_conflict_success"));
          setCurrentBranch("main");
          setHistoryRefreshKey((prev) => prev + 1);
        }}
        onCancel={async () => {
          setIsConflictModalOpen(false);
          if (projectPath) {
            try {
              logger.info(`Aborting merge and returning to original branch: ${currentBranch}`);
              await invoke("git_merge_abort", { 
                path: projectPath, 
                originalBranch: currentBranch 
              });
              setHistoryRefreshKey(prev => prev + 1);
            } catch (e) {
              logger.error(`Failed to abort merge: ${e}`);
              alert(t("layout.alert.abort_merge_failed", { error: e }));
            }
          }
        }}
      />

      <SyncSettingsModal
        isOpen={isSyncSettingsOpen}
        onClose={() => setIsSyncSettingsOpen(false)}
        currentFolderPath={projectPath || ""}
        githubToken={githubTokenForSync || ""}
        onSuccess={(remoteUrl) => {
          if (githubTokenForSync) {
            executeSync(remoteUrl, githubTokenForSync);
          }
        }}
      />
    </div>
  );
};

export default MainLayout;
