# Gitグラフ実装 (Git Graph) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ファイルタイムマシンのGitグラフコンポーネントにおいて、「ツリー形式」と「路線図形式」をユーザーが切り替えられるハイブリッドグラフの描画基盤を構築する。

**Architecture:** 既存の `GitGraph.tsx` 内に `graphStyle` (`"tree" | "metro"`) の状態を追加し、上部にトグルボタンを配置。状態に応じて `@gitgraph/react` のテンプレートを動的に切り替える。

**Tech Stack:** React, TypeScript, `@gitgraph/react`

---

### Task 1: GitGraphコンポーネントのCSSの更新

**Files:**
- Modify: `app-file-timemachine/src/components/graph/GitGraph.css`

- [ ] **Step 1: トグルボタン用のスタイルを追加する**

```css
/* app-file-timemachine/src/components/graph/GitGraph.css に追記 */

.git-graph-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.graph-style-toggle {
  display: flex;
  background-color: var(--bg-tertiary, #f6f8fa);
  border: 1px solid var(--border-color, #e1e4e8);
  border-radius: 6px;
  overflow: hidden;
}

.toggle-btn {
  background: none;
  border: none;
  padding: 4px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text-secondary, #586069);
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background-color: var(--bg-hover, #f1f8ff);
}

.toggle-btn.active {
  background-color: var(--bg-primary, #ffffff);
  color: var(--text-primary, #24292e);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

- [ ] **Step 2: Commit**

```bash
cd app-file-timemachine
git add src/components/graph/GitGraph.css
git commit -m "style: GitGraphのトグルボタン用のCSSを追加"
```

### Task 2: GitGraphコンポーネントのロジックとUIの更新

**Files:**
- Modify: `app-file-timemachine/src/components/graph/GitGraph.tsx`
- Modify: `変数関数仕様書.md` (Update state documentation)

- [ ] **Step 1: GitGraph.tsx を修正してトグルと動的テンプレート切り替えを実装する**

`app-file-timemachine/src/components/graph/GitGraph.tsx` の内容を以下のように完全に置き換えます。

```tsx
import { type FC, useEffect, useState } from "react";
import { Gitgraph, TemplateName, templateExtend, type TemplateOptions } from "@gitgraph/react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import "./GitGraph.css";

interface CommitLog {
  hash: string;
  timestamp: number;
  message: string;
}

type GraphStyle = "tree" | "metro";

/**
 * Accessibility Strategy:
 * - The SVG graph is given role="img" and an aria-label describing the commit history.
 * - For screen readers, we provide a hidden textual list of commits as an alternative representation.
 * - Interactive elements (toggle buttons) use semantic <button> tags with visual 'active' states.
 */

const GitGraph: FC = () => {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<CommitLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("metro");

  // カスタムテンプレート：日本語が綺麗に見えるようにフォントなどを微調整
  const getTemplate = (style: GraphStyle) => {
    const baseOptions: TemplateOptions = {
      colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
      commit: {
        message: {
          displayHash: true,
          font: "normal 12pt 'Segoe UI', 'Meiryo', sans-serif",
        },
      },
    };

    if (style === "tree") {
      // ツリー形式（標準的な丸みのあるデザイン）
      return templateExtend(TemplateName.BlackArrow, baseOptions);
    } else {
      // 路線図形式（直線的なデザイン）
      return templateExtend(TemplateName.Metro, baseOptions);
    }
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // 現在はデモ用にカレントディレクトリのログを取得（パス管理は将来的な課題）
        // TODO: App state からリポジトリパスを取得するように変更
        const logs = await invoke<CommitLog[]>("git_log", { path: "./" });
        setCommits(logs.reverse()); // 古い順に描画するためリバース
      } catch (e) {
        console.error("Failed to fetch logs:", e);
        setError(t("common.error.failed_to_fetch_logs"));
      }
    };

    fetchLogs();
  }, [t]);

  if (error) {
    return <div className="graph-error" role="alert">{error}</div>;
  }

  if (commits.length === 0) {
    return <div className="graph-empty">{t("common.placeholder.no_history")}</div>;
  }

  return (
    <div className="git-graph-wrapper">
      <div className="git-graph-header">
        <div className="graph-style-toggle" role="group" aria-label="Graph display style">
          <button 
            className={`toggle-btn ${graphStyle === "tree" ? "active" : ""}`}
            onClick={() => setGraphStyle("tree")}
            aria-pressed={graphStyle === "tree"}
          >
            🌳 ツリー
          </button>
          <button 
            className={`toggle-btn ${graphStyle === "metro" ? "active" : ""}`}
            onClick={() => setGraphStyle("metro")}
            aria-pressed={graphStyle === "metro"}
          >
            🚇 路線図
          </button>
        </div>
      </div>

      <div
        className="git-graph-svg-container"
        role="img"
        aria-label={t("common.aria.git_graph_description")}
      >
        <Gitgraph template={getTemplate(graphStyle)}>
          {(gitgraph: any) => {
            const master = gitgraph.branch("main");
            commits.forEach((commit) => {
              master.commit({
                hash: commit.hash.substring(0, 7),
                subject: commit.message,
                author: "User", // 将来的に取得
                onMessageClick: () => console.log("Commit clicked:", commit.hash),
              });
            });
          }}
        </Gitgraph>
      </div>

      {/* スクリーンリーダー向けの代替表示 */}
      <ul className="sr-only">
        {commits.map((commit) => (
          <li key={commit.hash.toString()}>
            {new Date(commit.timestamp * 1000).toLocaleString()}: {commit.message} ({commit.hash.substring(0, 7)})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GitGraph;
```

- [ ] **Step 2: 変数関数仕様書を更新する**

`変数関数仕様書.md` を開き、以下の内容を適切な場所（`GitGraph` コンポーネントがある場合はそこに追記、なければ新規追加）に追記します。

```markdown
#### `GitGraph`
- **ファイル**: `src/components/graph/GitGraph.tsx`
- **説明**: Gitのコミット履歴をSVGグラフとして可視化するコンポーネント。
- **状態 (State)**:
  - `commits: CommitLog[]`: 描画対象のコミットログ。
  - `error: string | null`: 取得時のエラー情報。
  - `graphStyle: "tree" | "metro"`: グラフの表示スタイル。ツリー形式と路線図形式を切り替える。
- **依存関係**:
  - `@gitgraph/react` (Gitgraph, templateExtend)
  - `src/utils/logger` (必要に応じて)
- **影響範囲**: ルート管理パネルの表示。
```

- [ ] **Step 3: TypeScript/ビルドの確認**

```bash
cd app-file-timemachine
npx tsc --noEmit
```
期待される結果: エラーなく完了すること。

- [ ] **Step 4: Commit**

```bash
cd app-file-timemachine
git add src/components/graph/GitGraph.tsx ../変数関数仕様書.md
git commit -m "feat: Gitグラフに表示スタイル（ツリー/路線図）の切り替え機能を追加"
```
