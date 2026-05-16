import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import GitGraph from "../graph/GitGraph";
import FilePreview from "../preview/FilePreview";
import SafetyDialog from "../guard/SafetyDialog";
import { analyzeFilesForSafety, type SafetyIssue } from "../../utils/safety";
import "./MainLayout.css";

/**
 * Accessibility Strategy:
 * - Use <main> tag for the primary layout container.
 * - Each resizable panel uses a <section> with an aria-label, which implicitly maps to role="region".
 * - Use <h2> tags within panel headers for proper document outline.
 * - PanelResizeHandle provides a visual and interactive indicator for resizing with focus-visible styles.
 * - Labels and headings are internationalized using i18next.
 * - The Save button is placed in a complementary role container at the bottom.
 */

const MainLayout: FC = () => {
  const { t } = useTranslation();
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);
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

  return (
    <div className="layout-wrapper">
      <main className="main-layout-container" aria-label={t("common.app_title")}>
        <PanelGroup orientation="horizontal">
          {/* ファイルツリーパネル */}
          <Panel defaultSize={20} minSize={15}>
            <section className="panel-content" aria-label={t("common.file_tree")}>
              <header className="panel-header">
                <h2>{t("common.file_tree")}</h2>
              </header>
              <div className="panel-body">{t("common.placeholder.file_tree")}</div>
            </section>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* ルート管理パネル（Gitグラフ） */}
          <Panel defaultSize={15} minSize={10}>
            <section className="panel-content" aria-label={t("common.root_management")}>
              <header className="panel-header">
                <h2>{t("common.root_management")}</h2>
              </header>
              <div className="panel-body">
                <GitGraph />
              </div>
            </section>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* 履歴リストパネル */}
          <Panel defaultSize={25} minSize={15}>
            <section className="panel-content" aria-label={t("common.history_list")}>
              <header className="panel-header">
                <h2>{t("common.history_list")}</h2>
              </header>
              <div className="panel-body">{t("common.placeholder.history_list")}</div>
            </section>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* プレビューパネル */}
          <Panel defaultSize={40} minSize={20}>
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
        <button 
          className="save-state-btn" 
          onClick={handleSaveClick}
          aria-haspopup="dialog"
        >
          {t("safety.action.save_anyway")} (Demo)
        </button>
      </footer>

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
    </div>
  );
};

export default MainLayout;
