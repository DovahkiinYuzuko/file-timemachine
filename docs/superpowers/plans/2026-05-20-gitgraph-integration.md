# GitGraphの組み込みとフォルダ初期化連動 実装計画書

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitGraphコンポーネントをメインレイアウトに組み込み、選択したプロジェクトフォルダのGit履歴と連動して路線図が描画され、Git未初期化の場合はその場で初期化ボタンから「履歴の保存を開始する」ことができるようにする。

**Architecture:** MainLayout.tsxからGitGraph.tsxにprojectPathとrefreshKey、および初期化成功時のコールバックを渡し、状態に応じて表示を切り替えます。GitGraph内でTauriのgit_initおよびgit_commitコマンドを呼び出します。

**Tech Stack:** React 19, TypeScript, Tauri v2, @gitgraph/react

---

### Task 1: GitGraph の Props定義とフォルダ未選択状態のUI実装

**Files:**
- Modify: `app-file-timemachine/src/components/graph/GitGraph.tsx`

- [ ] **Step 1: GitGraphProps インターフェースの定義と Props の受け取り**
  `GitGraph.tsx` の引数とPropsの型を定義し、現在 `commits` を取得する際に `path: "./"` とハードコードされている部分を `projectPath` に変更します。また、`useEffect` の依存配列に `projectPath` と `refreshKey` を追加します。

  ```typescript
  // 変更前 (1-23行目付近)
  // ...
  // const GitGraph: FC = () => {
  //   const { t } = useTranslation();
  //   const [commits, setCommits] = useState<CommitLog[]>([]);

  // 変更後
  interface GitGraphProps {
    projectPath: string | null;
    refreshKey?: number;
    onInitSuccess?: () => void;
  }

  const GitGraph: FC<GitGraphProps> = ({ projectPath, refreshKey, onInitSuccess }) => {
    const { t } = useTranslation();
    const [commits, setCommits] = useState<CommitLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [graphStyle, setGraphStyle] = useState<GraphStyle>("metro");
  ```

  および `useEffect` の書き換え：
  ```typescript
  // 変更前 (50-64行目付近)
  //   useEffect(() => {
  //     const fetchLogs = async () => {
  //       try {
  //         const logs = await invoke<CommitLog[]>("git_log", { path: "./" });
  //         setCommits(logs.reverse());
  //       } catch (e) { ... }
  //     };
  //     fetchLogs();
  //   }, [t]);

  // 変更後
  useEffect(() => {
    const fetchLogs = async () => {
      if (!projectPath) {
        setCommits([]);
        setError(null);
        return;
      }
      try {
        const logs = await invoke<CommitLog[]>("git_log", { path: projectPath });
        setCommits(logs.reverse());
        setError(null);
      } catch (e) {
        console.error("Failed to fetch logs:", e);
        setError(t("common.error.failed_to_fetch_logs"));
      }
    };

    fetchLogs();
  }, [projectPath, refreshKey, t]);
  ```

- [ ] **Step 2: フォルダ未選択時の初期メッセージ表示の実装**
  `projectPath` が `null` の場合に、「フォルダを開いてタイムマシンを開始しよう」という案内メッセージを返すようにUI分岐を追加します。

  ```typescript
  // 変更後 (GitGraph.tsx の return 部分の先頭に追加)
  if (!projectPath) {
    return (
      <div className="git-graph-wrapper empty-state">
        <div className="empty-message-container">
          <p className="empty-title">フォルダが選択されていません</p>
          <p className="empty-subtitle">サイドバーの「フォルダを開く」からプロジェクトフォルダを選択して、タイムマシンを開始しよう！</p>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: 型チェックとビルドの確認**
  ターミナルで TypeScript の型チェックを実行し、エラーが発生しないことを確認します。
  Command: `npm run build` (CWD: `app-file-timemachine`)
  Expected: コンパイルが正常に完了すること。

- [ ] **Step 4: コミット**
  ```bash
  git add app-file-timemachine/src/components/graph/GitGraph.tsx
  git commit -m "[feat] GitGraphにPropsを追加し、フォルダ未選択時の初期表示を実装"
  ```

---

### Task 2: 履歴未存在時の初期化ボタンと初期化アクションの実装

**Files:**
- Modify: `app-file-timemachine/src/components/graph/GitGraph.tsx`

- [ ] **Step 1: 初期化処理を実行する handleInit 関数の実装**
  Tauriの `git_init` と `git_commit` コマンドを順番に呼び出し、成功時に `onInitSuccess` を呼ぶ非同期関数を実装します。実行中はボタンを無効化するために `isInitializing` 状態を定義します。

  ```typescript
  // GitGraphPropsの直下に状態を追加
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInit = async () => {
    if (!projectPath) return;
    setIsInitializing(true);
    setError(null);
    try {
      // 1. git init を実行
      await invoke("git_init", { path: projectPath });
      // 2. 初回コミットを作成
      await invoke("git_commit", { path: projectPath, message: "最初の保存" });
      
      // 3. 成功コールバックを呼び出して親コンポーネント側の状態をリフレッシュ
      if (onInitSuccess) {
        onInitSuccess();
      }
    } catch (e) {
      console.error("Failed to initialize repository:", e);
      setError("履歴の保存開始に失敗したよ: " + String(e));
    } finally {
      setIsInitializing(false);
    }
  };
  ```

- [ ] **Step 2: 履歴が0件のときの「初期化ボタン」UIの実装**
  `commits.length === 0` の場合に、シンプルなメッセージと「履歴の保存を開始する」ボタンを表示するようにUIを修正します。

  ```typescript
  // 変更前 (commits.length === 0 の判定部分)
  // if (commits.length === 0) {
  //   return <div className="graph-empty">{t("common.placeholder.no_history")}</div>;
  // }

  // 変更後
  if (commits.length === 0) {
    return (
      <div className="git-graph-wrapper empty-state">
        <div className="empty-message-container">
          <p className="empty-title">履歴が見つかりませんでした</p>
          <p className="empty-subtitle">このフォルダでファイルの保存を開始して、タイムマシンを有効にしよう！</p>
          <button 
            className="init-git-btn" 
            onClick={handleInit}
            disabled={isInitializing}
          >
            {isInitializing ? "準備中..." : "履歴の保存を開始する"}
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: 型チェックとビルドの確認**
  ターミナルで型チェックを実行し、エラーが発生しないことを確認します。
  Command: `npm run build` (CWD: `app-file-timemachine`)
  Expected: コンパイルが正常に完了すること。

- [ ] **Step 4: コミット**
  ```bash
  git add app-file-timemachine/src/components/graph/GitGraph.tsx
  git commit -m "[feat] GitGraphにGit未初期化時の履歴保存開始ボタンと初期化処理を実装"
  ```

---

### Task 3: MainLayout.tsx への GitGraph の組み込み

**Files:**
- Modify: `app-file-timemachine/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: GitGraph のインポートコメントアウト解除**
  `MainLayout.tsx` 内でコメントアウトされていた `GitGraph` のインポートを有効にします。

  ```typescript
  // 変更前 (10行目付近)
  // import HelpModal from "../help/HelpModal";
  // import Tooltip from "../common/Tooltip";
  // import logger from "../../utils/logger";

  // 変更後
  import GitGraph from "../graph/GitGraph";
  ```

- [ ] **Step 2: プレースホルダーの置き換え**
  路線図表示のプレースホルダー `<div>(Git Graph Placeholder)</div>` を、`<GitGraph>` に置き換えます。

  ```typescript
  // 変更前 (151-153行目付近)
  // <div className="panel-body">
  //   {/* <GitGraph /> */}
  //   <div>(Git Graph Placeholder)</div>
  // </div>

  // 変更後
  <div className="panel-body">
    <GitGraph 
      projectPath={projectPath} 
      refreshKey={historyRefreshKey} 
      onInitSuccess={() => setHistoryRefreshKey(prev => prev + 1)} 
    />
  </div>
  ```

- [ ] **Step 3: 型チェックとビルドの確認**
  ターミナルでビルドを実行し、型エラーやバンドルエラーがないことを確認します。
  Command: `npm run build` (CWD: `app-file-timemachine`)
  Expected: ビルドが正常に完了すること。

- [ ] **Step 4: コミット**
  ```bash
  git add app-file-timemachine/src/components/layout/MainLayout.tsx
  git commit -m "[feat] MainLayoutにGitGraphコンポーネントを組み込み、状態連動を設定"
  ```
