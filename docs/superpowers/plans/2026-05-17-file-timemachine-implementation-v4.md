# ファイルタイムマシン 実装プラン (v4: 基礎固め)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ファイルツリーの動的表示、Windows日本語パス問題の完全解決、およびアプリ全体へのデバッグログ配置を行い、ハリボテ状態を解消する。

**Architecture:** 
- **Backend**: Rustで再帰的なディレクトリ走査とパス正規化（dunce）を実装。
- **Frontend**: Reactで再帰的な TreeView コンポーネントを構築。
- **Logging**: `tauri-plugin-log` を活用し、全API・イベントに詳細ログを仕込む。

---

### Task 1: 本物のファイルツリー取得（Rust）

**Files:**
- Create: `app-file-timemachine/src-tauri/src/commands/files.rs`
- Modify: `app-file-timemachine/src-tauri/src/commands/mod.rs`
- Modify: `app-file-timemachine/src-tauri/src/lib.rs`

- [ ] **Step 1: フォルダ走査コマンド `get_file_tree` の実装**
`walkdir` 等を使い、指定されたパス配下のファイル・ディレクトリを再帰的に取得する。`dunce::canonicalize` でパスを正規化し、ログを出力する。
- [ ] **Step 2: コマンドの登録**
`lib.rs` に新コマンドを登録。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: Rust側でのファイルツリー取得コマンドの実装"
```

### Task 2: 洗練されたファイルツリーUI（React）

**Files:**
- Create: `app-file-timemachine/src/components/tree/FileTree.tsx`
- Modify: `app-file-timemachine/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: 再帰的なツリーコンポーネントの作成**
`invoke('get_file_tree')` を呼び出し、取得したデータを階層構造で表示。Lucideアイコン（Folder, File）を使い分ける。
- [ ] **Step 2: `MainLayout` への統合**
仮テキストを本物の `FileTree` に置き換える。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: Reactでの動的なファイルツリー表示の実装"
```

### Task 3: 言語切り替えバグ修正とデバッグログの徹底

**Files:**
- Modify: `app-file-timemachine/src/components/settings/SettingsModal.tsx`
- Modify: アプリ内各所

- [ ] **Step 1: 言語切り替えの即時反映**
`i18n.changeLanguage` の呼び出しを修正し、モーダル内のテキストも即座に切り替わるようにする。
- [ ] **Step 2: デバッグログの全域配置**
ボタンクリック、モーダル開閉、エラー発生時などに `logger.debug` 等を仕込みまくる。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "fix: 言語切り替えバグの修正と全域デバッグログの配置"
```

### Task 4: GitHubオススメ（ライトテーマ）の適用

**Files:**
- Modify: `app-file-timemachine/src/App.css`
- Modify: `app-file-timemachine/src/components/settings/SettingsModal.tsx` (Theme toggle)

- [ ] **Step 1: CSS変数によるテーマ定義**
`GitHub人気DESIGN.md` の配色をライトテーマ変数として定義。
- [ ] **Step 2: テーマ切り替え機能の実装**
設定画面でダーク/ライトを選べるようにし、`body` クラス等を操作して反映。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: GitHub風ライトテーマの適用とテーマ切り替え機能"
```
