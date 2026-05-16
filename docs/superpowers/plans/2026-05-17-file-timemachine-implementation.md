# ファイルタイムマシン 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri v2 + React (TS) を使用して、非エンジニア向けの直感的なGitクライアント「ファイルタイムマシン」のMVPを構築する。

**Architecture:** Rust (Tauri Backend) でGitコマンドとファイルシステムを操作し、React (Frontend) でモダンな4カラムUIとSVGグラフを表示する。i18n設定は外部JSONで管理し、拡張性を確保する。

**Tech Stack:** Tauri v2, React, TypeScript, Vite, react-i18next, react-resizable-panels, @gitgraph/react, shadcn/ui.

---

### Task 1: プロジェクトの初期化

**Files:**
- Create: `app-file-timemachine/` (Tauri scaffolding)

- [ ] **Step 1: Tauriアプリのスカフォールディングを実行**
Run: `npm create tauri-app@latest app-file-timemachine -- --template react-ts -y` (※既にフォルダがある場合は中身を作成)

- [ ] **Step 2: 依存関係のインストール**
Run: `cd app-file-timemachine; npm install`

- [ ] **Step 3: 開発サーバーの起動確認**
Run: `npm run tauri dev`
Expected: Tauriのデフォルト画面が表示される。

- [ ] **Step 4: Commit**
```bash
git add app-file-timemachine
git commit -m "feat: Tauri v2 + React (TS) プロジェクトの初期化"
```

### Task 2: UI基盤（4カラム・可変幅）の構築

**Files:**
- Modify: `app-file-timemachine/src/App.tsx`
- Create: `app-file-timemachine/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: `react-resizable-panels` のインストール**
Run: `npm install react-resizable-panels`

- [ ] **Step 2: 4カラムレイアウトの実装**
`MainLayout.tsx` に `PanelGroup` を使用して、ツリー、ルート、履歴、プレビューの4つのパネルを作成する。

- [ ] **Step 3: `App.tsx` での適用とプレビュー確認**

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: react-resizable-panels を使用した4カラムレイアウトの実装"
```

### Task 3: 多言語化 (i18n) のセットアップ

**Files:**
- Create: `app-file-timemachine/src/i18n/config.ts`
- Create: `app-file-timemachine/public/locales/ja/translation.json`
- Create: `app-file-timemachine/public/locales/en/translation.json`

- [ ] **Step 1: i18nライブラリのインストール**
Run: `npm install i18next react-i18next i18next-http-backend`

- [ ] **Step 2: 設定ファイルと辞書ファイルの作成**
日英の基本ワード（「保存」「ルート」など）を定義する。

- [ ] **Step 3: Appへの組み込みとトグルテスト**

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: i18next による多言語化基盤の構築"
```

### Task 4: 環境診断ウィザードの実装

**Files:**
- Create: `app-file-timemachine/src-tauri/src/commands/setup.rs`
- Modify: `app-file-timemachine/src-tauri/src/lib.rs`
- Create: `app-file-timemachine/src/components/setup/Wizard.tsx`

- [ ] **Step 1: Rust側でGit/Homebrew/ghの有無をチェックするコマンドを作成**

- [ ] **Step 2: フロントエンドで診断結果を表示するウィザードUIを作成**

- [ ] **Step 3: インストールガイド（コマンド提示など）の実装**

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: Git/Homebrew環境診断ウィザードの実装"
```

### Task 5: Git連携機能（保存・履歴取得）

**Files:**
- Create: `app-file-timemachine/src-tauri/src/commands/git.rs`

- [ ] **Step 1: Rust側で `git init`, `git add`, `git commit` を実行するコマンドを作成**

- [ ] **Step 2: コミットログ（履歴）をJSON形式で取得するコマンドを作成**

- [ ] **Step 3: ホワイトリスト方式の `.gitignore` 自動生成ロジックの実装**

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: Rust側でのGit基本操作コマンドの実装"
```

### Task 6: グラフビュー & プレビュー機能

**Files:**
- Create: `app-file-timemachine/src/components/graph/GitGraph.tsx`
- Create: `app-file-timemachine/src/components/preview/FilePreview.tsx`

- [ ] **Step 1: `@gitgraph/react` を使用した履歴の可視化**

- [ ] **Step 2: ファイルツリーからのプレビュー（テキスト・画像）表示**

- [ ] **Step 3: グラフとプレビューの連動処理**

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: SVGグラフ表示とファイルプレビューの実装"
```

### Task 7: 安全ガード（脆弱性・危険ファイル検知）

**Files:**
- Create: `app-file-timemachine/src/utils/safety.ts`

- [ ] **Step 1: 危険ファイル（.env, .exe等）や巨大ファイルをチェックするロジックの実装**

- [ ] **Step 2: 保存前の警告ダイアログの実装**

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: 危険ファイル検知と安全ガード機能の追加"
```
