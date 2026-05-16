import React from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import "./MainLayout.css";

/**
 * Accessibility Strategy:
 * - Use <main> tag for the primary layout container.
 * - Each resizable panel uses a <section> with an aria-label, which implicitly maps to role="region".
 * - Use <h2> tags within panel headers for proper document outline.
 * - PanelResizeHandle provides a visual and interactive indicator for resizing with focus-visible styles.
 */

const MainLayout: React.FC = () => {
  return (
    <main className="main-layout-container" aria-label="ファイルタイムマシン メインレイアウト">
      <PanelGroup orientation="horizontal">
        {/* ファイルツリーパネル */}
        <Panel defaultSize={20} minSize={15}>
          <section className="panel-content" aria-label="ファイルツリー">
            <header className="panel-header">
              <h2>ファイルツリー</h2>
            </header>
            <div>（ここにファイルツリーが表示されるよ）</div>
          </section>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* ルート管理パネル */}
        <Panel defaultSize={15} minSize={10}>
          <section className="panel-content" aria-label="ルート管理">
            <header className="panel-header">
              <h2>ルート管理</h2>
            </header>
            <div>（ここにルート管理が表示されるよ）</div>
          </section>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* 履歴リストパネル */}
        <Panel defaultSize={25} minSize={15}>
          <section className="panel-content" aria-label="履歴リスト">
            <header className="panel-header">
              <h2>履歴リスト</h2>
            </header>
            <div>（ここに履歴リストが表示されるよ）</div>
          </section>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* プレビューパネル */}
        <Panel defaultSize={40} minSize={20}>
          <section className="panel-content" aria-label="プレビュー">
            <header className="panel-header">
              <h2>プレビュー</h2>
            </header>
            <div>（ここにプレビューが表示されるよ）</div>
          </section>
        </Panel>
      </PanelGroup>
    </main>
  );
};

export default MainLayout;
