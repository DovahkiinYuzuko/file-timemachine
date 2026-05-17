import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Save } from "lucide-react";
import Sidebar, { type SidebarTab } from "./Sidebar";
import FileTree from "../tree/FileTree";
import FilePreview from "../preview/FilePreview";
import SafetyDialog from "../guard/SafetyDialog";
import SettingsModal from "../settings/SettingsModal";
import HelpModal from "../help/HelpModal";
import Tooltip from "../common/Tooltip";
import logger from "../../utils/logger";
import { analyzeFilesForSafety, type SafetyIssue } from "../../utils/safety";
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

  // フォルダ選択時の処理
  const handleOpenFolder = (path: string) => {
    logger.info(`フォルダを選択したよ: ${path}`);
    setProjectPath(path);
  };

  // 保存ボタンが押された時のシミュレーション
  const handleSaveClick = () => {
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

    alert("保存したよ！（自動スキャン: " + (isAutoScanEnabled ? "ON" : "OFF") + "）");
    logger.info("保存が完了したよ");
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
            {/* 1. ファイルツリーパネル（左）：Filesタブ의 時のみ表示 */}
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
                          {/* <GitGraph /> */}
                          <div>(Git Graph Placeholder)</div>
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
                        <div className="panel-body">{t("common.placeholder.history_list")}</div>
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
              aria-haspopup="dialog"
            >
              <Save size={18} aria-hidden="true" />
              {t("help.commands.save.op")} (Demo)
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
          alert("強引に保存したよ！");
        }}
        onConfirmExclude={() => {
          setIsSafetyDialogOpen(false);
          alert("ヤバいファイルを除いて保存したよ！");
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
    </div>
  );
};

export default MainLayout;
