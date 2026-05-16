import React from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import "./MainLayout.css";

/**
 * Accessibility Strategy:
 * - Use <main> tag for the primary layout container.
 * - Each resizable panel is marked with an aria-label.
 * - PanelResizeHandle provides a visual and interactive indicator for resizing.
 */

const MainLayout: React.FC = () => {
  return (
    <main className="main-layout-container" aria-label="ファイルタイムマシン メインレイアウト">
      <PanelGroup orientation="horizontal">
        {/* ファイルツリーパネル */}
        <Panel defaultSize={20} minSize={15} aria-label="ファイルツリー">
          <div className="panel-content">
            <header className="panel-header">ファイルツリー</header>
            <div>（ここにファイルツリーが表示されるよ）</div>
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* ルート管理パネル */}
        <Panel defaultSize={15} minSize={10} aria-label="ルート管理">
          <div className="panel-content">
            <header className="panel-header">ルート管理</header>
            <div>（ここにルート管理が表示されるよ）</div>
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* 履歴リストパネル */}
        <Panel defaultSize={25} minSize={15} aria-label="履歴リスト">
          <div className="panel-content">
            <header className="panel-header">履歴リスト</header>
            <div>（ここに履歴リストが表示されるよ）</div>
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* プレビューパネル */}
        <Panel defaultSize={40} minSize={20} aria-label="プレビュー">
          <div className="panel-content">
            <header className="panel-header">プレビュー</header>
            <div>（ここにプレビューが表示されるよ）</div>
          </div>
        </Panel>
      </PanelGroup>
    </main>
  );
};

export default MainLayout;
