# ファイルタイムマシン 実装プラン (v7: 中身で勝負する究極プレビュー判定)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拡張子リストに頼った脆弱な判定を廃止し、Rust側でファイルの中身（マジックナンバー・バイト走査）からファイル種別を正確に特定するインテリジェントなプレビュー判定を実装する。

**Architecture:** 
- **Back-end Identification**: Rust側で `content_inspector`（テキスト判定）と `infer`（MIMEタイプ特定）を使用。
- **Unified Info API**: `get_file_info` コマンドを強化し、サイズ・更新日時に加え、確定した `file_type` と `mime_type` を返すようにする。
- **React Logic**: フロントエンドの拡張子判定を削除し、バックエンドから送られてきた確定情報を元にレンダリングを切り替える。

---

### Task 1: インテリジェントな種別判定エンジンの実装 (Rust)

**Files:**
- Modify: `app-file-timemachine/src-tauri/Cargo.toml` (Add `content_inspector`, `infer`)
- Modify: `app-file-timemachine/src-tauri/src/commands/files.rs`

- [ ] **Step 1: 判定用ライブラリの導入**
`content_inspector = "0.2"` と `infer = "0.15"` を `Cargo.toml` に追加してください。

- [ ] **Step 2: `get_file_info` の極限強化**
ファイルを先頭数KB読み込み、以下のロジックで種別を確定させてください。
1. `infer::get` で MIME タイプを特定。
2. 特定できなかった場合、`content_inspector::inspect` でテキストかどうかを判定。
3. `FileInfo` 構造体に `file_type` ("text" | "image" | "video" | "audio" | "unknown") と `mime_type` (String) を追加して返却するようにします。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: content_inspector と infer による中身ベースのファイル種別判定"
```

### Task 2: バックエンド情報に基づくUIレンダリングの刷新 (React)

**Files:**
- Modify: `app-file-timemachine/src/components/preview/FilePreview.tsx`

- [ ] **Step 1: 拡張子ベース判定の完全撤廃**
`FilePreview.tsx` 内の `useMemo` で行っていた拡張子による種別判定ロジックを削除してください。

- [ ] **Step 2: バックエンド情報の信頼**
`get_file_info` から返ってきた `file_type` を直接使って、表示コンポーネント（`<pre>`, `<img>`, etc.）を切り替えるように修正します。これで `.gitignore` も「text」として正しく扱われます。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "refactor: バックエンドの判定結果に基づくプレビュー表示への移行"
```

### Task 3: 最終検証とドキュメント同期

**Files:**
- Modify: `変数関数仕様書.md`
- Modify: `ハリボテリスト.md`

- [ ] **Step 1: 仕様書の更新**
`FileInfo` 構造体の変更内容と、新しく導入した判定ロジックについて追記します。
- [ ] **Step 2: ハリボテリストの更新**
今回の「中身判定」によって解決された「隠れたハリボテ（ドットファイル対応等）」について記載します。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "docs: 究極プレビュー判定の仕様書同期と完了報告"
```
