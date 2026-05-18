# 履歴リスト動的表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ファイルタイムマシンのフロントエンドに、Rust側から取得した実際のGit履歴を動的かつシンプルに表示する。

**Architecture:** `HistoryList`コンポーネントを新設し、Tauriの`invoke`で`git_log`を呼び出す。取得した`CommitLog`の配列を`<table>`形式で表示し、`MainLayout`内のプレースホルダーと差し替える。

**Tech Stack:** React, TypeScript, Tauri (`@tauri-apps/api/core`), i18next

---

### Task 1: TypeScript型定義の追加

**Files:**
- Modify: `app-file-timemachine/src/types/gitgraph.d.ts` (または共通型定義ファイル、ここでは既存の`gitgraph.d.ts`に追記するか新規作成。今回は新規作成が無難だが、既存の型定義ファイルがあればそこに追加する。ここでは`types/git.ts`を新規作成する)
- Create: `app-file-timemachine/src/types/git.ts`

- [ ] **Step 1: 型定義ファイルを作成する**

```typescript
// app-file-timemachine/src/types/git.ts
export interface CommitLog {
  hash: string;
  timestamp: number;
  message: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd app-file-timemachine
git add src/types/git.ts
git commit -m "feat: CommitLogの型定義を追加"
```

### Task 2: HistoryListコンポーネントのCSS作成

**Files:**
- Create: `app-file-timemachine/src/components/history/HistoryList.css`

- [ ] **Step 1: CSSファイルを作成する**

```css
/* app-file-timemachine/src/components/history/HistoryList.css */
.history-list-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.history-table th,
.history-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #e1e4e8);
}

.history-table th {
  background-color: var(--bg-tertiary, #f6f8fa);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}

.history-table tr:hover {
  background-color: var(--bg-hover, #f1f8ff);
}

.history-hash {
  font-family: monospace;
  color: var(--text-secondary, #586069);
}

.history-message {
  font-weight: 500;
  color: var(--text-primary, #24292e);
}

.history-date {
  color: var(--text-secondary, #586069);
  white-space: nowrap;
}

.history-empty,
.history-error {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary, #586069);
}

.history-error {
  color: var(--error-color, #cb2431);
}
```

- [ ] **Step 2: Commit**

```bash
cd app-file-timemachine
git add src/components/history/HistoryList.css
git commit -m "style: HistoryListコンポーネントのCSSを追加"
```

### Task 3: HistoryListコンポーネントの実装

**Files:**
- Create: `app-file-timemachine/src/components/history/HistoryList.tsx`

- [ ] **Step 1: Reactコンポーネントを作成する**

```tsx
// app-file-timemachine/src/components/history/HistoryList.tsx
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import type { CommitLog } from "../../types/git";
import "./HistoryList.css";

interface HistoryListProps {
  projectPath: string | null;
  refreshKey?: number;
}

const HistoryList: FC<HistoryListProps> = ({ projectPath, refreshKey = 0 }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<CommitLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath) {
      setLogs([]);
      return;
    }

    let isMounted = true;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        logger.debug(`履歴を取得するよ: ${projectPath}`);
        const result = await invoke<CommitLog[]>("git_log", { path: projectPath });
        if (isMounted) {
          setLogs(result);
          logger.info(`履歴を ${result.length} 件取得したよ`);
        }
      } catch (e) {
        logger.error(`履歴の取得に失敗したよ: ${e}`);
        if (isMounted) {
          setError(String(e));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, [projectPath, refreshKey]);

  const formatDate = (timestamp: number) => {
    // Rust側が秒単位のUNIXタイムスタンプを返す前提
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  if (isLoading) {
    return <div className="history-empty">{t("common.loading")}</div>;
  }

  if (error) {
    return <div className="history-error">{t("common.error.failed_to_fetch_logs")}</div>;
  }

  if (logs.length === 0) {
    return <div className="history-empty">{t("common.placeholder.no_history")}</div>;
  }

  return (
    <div className="history-list-container" aria-label={t("common.history_list")}>
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Message</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.hash}>
              <td className="history-date">{formatDate(log.timestamp)}</td>
              <td className="history-message">{log.message}</td>
              <td className="history-hash">{log.hash.substring(0, 7)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryList;
```

- [ ] **Step 2: Commit**

```bash
cd app-file-timemachine
git add src/components/history/HistoryList.tsx
git commit -m "feat: HistoryListコンポーネントを実装"
```

### Task 4: MainLayoutへの組み込み

**Files:**
- Modify: `app-file-timemachine/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: MainLayoutにHistoryListをインポートし、組み込む**

`src/components/layout/MainLayout.tsx` を開き、以下の変更を行う。

1. インポートを追加:
```tsx
import HistoryList from "../history/HistoryList";
```

2. `refreshKey` の状態を追加 (コンポーネント内の上部):
```tsx
const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
```

3. `handleSaveClick` の成功時に `setHistoryRefreshKey` を呼ぶように修正:
```tsx
  const handleSaveClick = async () => {
    logger.info("保存ボタンが押されたよ。安全スキャンを開始するね");
    const isAutoScanEnabled = localStorage.getItem("settings_auto_scan") !== "false";

    if (isAutoScanEnabled) {
      // ... 既存の安全スキャンロジック ...
    }

    // デモ用のアラートは残しつつ、リフレッシュキーを更新
    alert("保存したよ！（自動スキャン: " + (isAutoScanEnabled ? "ON" : "OFF") + "）");
    logger.info("保存が完了したよ");
    
    // 保存後に履歴を再取得させる
    setHistoryRefreshKey(prev => prev + 1);
  };
```

4. プレースホルダーを `HistoryList` に置き換える:
```tsx
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
```

- [ ] **Step 2: TypeScript/ビルドの確認**

```bash
cd app-file-timemachine
npm run build
```
期待される結果: エラーなくビルドが完了すること。

- [ ] **Step 3: Commit**

```bash
cd app-file-timemachine
git add src/components/layout/MainLayout.tsx
git commit -m "feat: MainLayoutにHistoryListを組み込み、履歴の動的表示に対応"
```

