import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import GitGraph from "../graph/GitGraph";
import FilePreview from "../preview/FilePreview";
import "./MainLayout.css";

/**
 * Accessibility Strategy:
 * - Use <main> tag for the primary layout container.
 * - Each resizable panel uses a <section> with an aria-label, which implicitly maps to role="region".
 * - Use <h2> tags within panel headers for proper document outline.
 * - PanelResizeHandle provides a visual and interactive indicator for resizing with focus-visible styles.
 * - Labels and headings are internationalized using i18next.
 */

const MainLayout: FC = () => {
  const { t } = useTranslation();

  return (
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
  );
};

export default MainLayout;
