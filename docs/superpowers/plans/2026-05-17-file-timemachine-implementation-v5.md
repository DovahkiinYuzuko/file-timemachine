# ファイルタイムマシン 実装プラン (v5: 究極のGit管理 ＆ プレビュー)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロジェクト別の管理モード（ホワイト/ブラックリスト）の実装、チェックボックス付きファイルツリー、および本物のファイルプレビュー機能を構築する。

**Architecture:** 
- **Hidden Config**: 各フォルダに `.file-timemachine.json` を置き、モードを永続化。
- **Git Logic**: Rust側で `.gitignore` をパース・更新する高度なロジックを実装。
- **UI**: 再帰的なチェックボックスステート管理と、`backdrop-filter` 活用したグレーアウト表示。
- **Preview**: Rust側でファイル内容を読み取り、Reactで表示。

---

### Task 1: プロジェクト設定とGitモード管理（Rust ＆ React）

**Files:**
- Create: `app-file-timemachine/src-tauri/src/commands/config.rs`
- Modify: `app-file-timemachine/src-tauri/src/commands/mod.rs`
- Modify: `app-file-timemachine/src-tauri/src/lib.rs`
- Modify: `app-file-timemachine/src/components/tree/FileTree.tsx`

- [ ] **Step 1: プロジェクト設定の読み書きコマンド実装**
`get_project_config` と `set_project_config` を作成。`.file-timemachine.json` をルートに作成し、`git_mode` ("whitelist" | "blacklist") を保存・取得する。
- [ ] **Step 2: UIへのモード表示と切り替え機能の追加**
`FileTree.tsx` のヘッダーに現在のモードを表示し、クリックで切り替えコマンドを呼び出すようにする。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: プロジェクト単位の管理モード設定機能の実装"
```

### Task 2: チェックボックス付き・無視対応ツリー（Rust ＆ React）

**Files:**
- Modify: `app-file-timemachine/src-tauri/src/commands/files.rs`
- Modify: `app-file-timemachine/src/components/tree/FileTree.tsx`
- Modify: `app-file-timemachine/src/components/tree/FileTree.css`

- [ ] **Step 1: 無視状態の取得（Rust）**
`get_file_tree` を更新。各ファイルが `.gitignore` によって無視されているかどうかを判定し、`is_ignored: boolean` を返すようにする。
- [ ] **Step 2: チェックボックスUIとグレーアウトの実装**
`FileTreeItem` にチェックボックスを追加。`is_ignored` が true の場合は文字を薄く（グレーアウト）表示する。
- [ ] **Step 3: ハイブリッドチェックボックスロジックの実装**
フォルダのチェックを外すと子要素を全除外、チェックを入れると管理対象にするロジック。
チェック変更時に Rust の `update_gitignore`（新規作成）を呼び出して `.gitignore` を物理的に更新する。

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: チェックボックス付き・無視状態対応のファイルツリー刷新"
```

### Task 3: 本物のファイルプレビュー機能

**Files:**
- Create: `app-file-timemachine/src-tauri/src/commands/preview.rs`
- Modify: `app-file-timemachine/src-tauri/src/commands/mod.rs`
- Modify: `app-file-timemachine/src/components/preview/FilePreview.tsx`

- [ ] **Step 1: ファイル読み取りコマンドの実装（Rust）**
`read_file_content` コマンドを作成。パスを受け取り、テキストとして読み取って返す。バイナリ（画像等）の場合は Tauri のアセットプロトコルを活用するか、Base64で返すようにする。
- [ ] **Step 2: プレビュー画面の「本物化」**
`MainLayout` でファイルがクリックされた際にそのパスを保持。`FilePreview.tsx` でそのパスのコンテンツを取得して表示する。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: 本物のファイル内容プレビュー機能の実装"
```

### Task 4: ハリボテリストの更新と最終調整

**Files:**
- Modify: `ハリボテリスト.md`
- Modify: `変数関数仕様書.md`

- [ ] **Step 1: 実装した機能のチェックマークを入れる**
- [ ] **Step 2: 全域デバッグログの再確認と追加**

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "docs: ハリボテリストの更新と全機能の最終調整"
```
