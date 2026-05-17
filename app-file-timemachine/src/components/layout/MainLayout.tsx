import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import Sidebar, { type SidebarTab } from "./Sidebar";
import GitGraph from "../graph/GitGraph";
import FilePreview from "../preview/FilePreview";
import SafetyDialog from "../guard/SafetyDialog";
import SettingsModal from "../settings/SettingsModal";
import HelpModal from "../help/HelpModal";
import Tooltip from "../common/Tooltip";
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
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [safetyIssues, setSafetyIssues] = useState<SafetyIssue[]>([]);

  // 保存ボタンが押された時のシミュレーション
  const handleSaveClick = () => {
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
      setSafetyIssues(issues);
      setIsSafetyDialogOpen(true);
    } else {
      alert("保存したよ！（問題なし）");
    }
  };

  const handleTabChange = (tab: SidebarTab) => {
    if (tab === "settings") {
      setIsSettingsModalOpen(true);
    } else if (tab === "help") {
      setIsHelpModalOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleSettingsClose = () => {
    setIsSettingsModalOpen(false);
  };

  const handleHelpClose = () => {
    setIsHelpModalOpen(false);
  };

  return (
    <div className="layout-wrapper">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="layout-main-content">
        <main className="main-layout-container" aria-label={t("common.app_title")}>
          <PanelGroup orientation="horizontal">
            {/* 1. ファイルツリーパネル（左） */}
            <Panel defaultSize={20} minSize={15}>
              <section className="panel-content" aria-label={t("common.file_tree")}>
                <header className="panel-header">
                  <h2>{t("common.file_tree")}</h2>
                </header>
                <div className="panel-body">{t("common.placeholder.file_tree")}</div>
              </section>
            </Panel>

            <PanelResizeHandle className="resize-handle" />

            {/* 2. 履歴・ルート管理パネル（中央：上下分割） */}
            <Panel defaultSize={35} minSize={25}>
              <PanelGroup orientation="vertical">
                {/* 上段：GitGraph */}
                <Panel defaultSize={50} minSize={20}>
                  <section className="panel-content" aria-label={t("common.root_management")}>
                    <header className="panel-header">
                      <h2>
                        {t("common.root_management")}
                        <Tooltip content="Git用語では「ブランチ(branch)」と呼びます。新しい試みを安全に行うための分かれ道です。" />
                      </h2>
                    </header>
                    <div className="panel-body">
                      <GitGraph />
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
                        <Tooltip content="Git用語では「ログ(log)」と呼びます。過去に行った「保存（コミット）」の記録です。" />
                      </h2>
                    </header>
                    <div className="panel-body">{t("common.placeholder.history_list")}</div>
                  </section>
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="resize-handle" />

            {/* 3. プレビューパネル（右） */}
            <Panel defaultSize={45} minSize={30}>
              <section className="panel-content" aria-label={t("common.preview")}>
                <header className="panel-header">
                  <h2>{t("common.preview")}</h2>
                </header>
                <div className="panel-body">
                  <FilePreview />
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
              {t("safety.action.save_anyway")} (Demo)
            </button>
            <Tooltip content="Git用語では「コミット(commit)」と呼びます。現在の作業状態に名前をつけて保存します。" />
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
