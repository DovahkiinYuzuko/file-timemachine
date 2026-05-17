# ファイルタイムマシン 実装プラン (v3: フォルダ選択 ＆ 視認性改善)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フォルダ選択機能、既存Gitリポジトリ対応、および設定画面の視認性改善を実装する。

**Architecture:** 
- **Frontend**: `tauri-plugin-dialog` によるフォルダ選択フローの追加。
- **Backend**: `dunce` 等を活用したWindowsパスの正規化ロジックの導入。
- **UI**: CSS の `backdrop-filter` とソリッドな背景色による視認性向上。

---

### Task 1: フォルダ選択機能の実装

**Files:**
- Modify: `app-file-timemachine/src-tauri/Cargo.toml`
- Modify: `app-file-timemachine/src-tauri/src/lib.rs`
- Modify: `app-file-timemachine/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: `tauri-plugin-dialog` のセットアップ**
`Cargo.toml` に追加し、`lib.rs` でプラグインを登録。`capabilities/default.json` に権限を追加。

- [ ] **Step 2: サイドバーへのフォルダ選択ボタン追加**
Lucideの `FolderOpen` アイコンを一番上に配置。クリック時に `open` ダイアログを呼び出す。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: tauri-plugin-dialog によるフォルダ選択機能の実装"
```

### Task 2: パス正規化と既存Git対応の強化

**Files:**
- Modify: `app-file-timemachine/src-tauri/src/commands/git.rs`
- Modify: `app-file-timemachine/src-tauri/Cargo.toml` (Add `dunce`)

- [ ] **Step 1: Windowsパスの正規化ロジック導入**
`dunce` を使用して、日本語やバックスラッシュを含むパスを安全に処理するように各Gitコマンドを修正。

- [ ] **Step 2: 既存リポジトリ読み込みの安定化**
`.git` が既にある場合に正しく履歴を取得できるよう、パスハンドリングを徹底。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "fix: Windowsパス正規化と既存Gitリポジトリ対応の強化"
```

### Task 3: UI視認性の改善とアイコン統一

**Files:**
- Modify: `app-file-timemachine/src/components/settings/SettingsModal.css`
- Modify: `app-file-timemachine/src/components/help/HelpModal.css`
- Modify: 各種コンポーネント (Remove emojis)

- [ ] **Step 1: モーダルの背景とブラーの適用**
背景色を `#1e1e1e` に固定し、`backdrop-filter: blur(8px)` をオーバーレイに追加。

- [ ] **Step 2: アイコンのLucide統一**
プランやコードから絵文字を完全に排除し、Lucideアイコンのみを使用する。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "style: モーダルの視認性改善とアイコンのLucide統一"
```
