# ファイルタイムマシン 実装プラン (v6: 究極のプレビュー ＆ メディア対応)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テキストの文字コード問題（Shift-JIS等）の完全解決、および画像・動画・音声のマルチメディアプレビューを実装し、限界突破したプレビュー機能を実現する。

**Architecture:** 
- **Text Engine**: Rust側で `encoding_rs` を使用し、文字コードを自動判定して UTF-8 に変換して返却。
- **Asset Protocol**: 画像・動画・音声は Tauri v2 の `convertFileSrc` (Asset Protocol) を使用して WebView に直接流し込む。
- **Dynamic UI**: React側で拡張子・MIMEタイプに基づき、`<pre>`, `<img>`, `<video>`, `<audio>` を動的に切り替えて表示。

---

### Task 1: マルチエンコーディング対応テキスト取得（Rust）

**Files:**
- Modify: `app-file-timemachine/src-tauri/Cargo.toml` (Add `encoding_rs`, `chardetng`)
- Modify: `app-file-timemachine/src-tauri/src/commands/preview.rs`

- [ ] **Step 1: 依存関係の追加**
`encoding_rs = "0.8"` と `chardetng = "0.1"` を `Cargo.toml` に追加してください。
- [ ] **Step 2: 自動判定ロジックの実装**
`read_file_content` を更新。ファイルをバイナリとして読み込み、`chardetng` でエンコーディングを推定。`encoding_rs` で UTF-8 に変換して返すようにします。Shift-JIS や EUC-JP もこれで完璧！
- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: encoding_rs によるマルチエンコーディング（Shift-JIS等）対応"
```

### Task 2: マルチメディアプレビュー基盤（React ＆ Tauri）

**Files:**
- Modify: `app-file-timemachine/src/components/preview/FilePreview.tsx`
- Modify: `app-file-timemachine/src-tauri/capabilities/default.json` (Ensure protocol access)

- [ ] **Step 1: アセットプロトコルの許可**
`tauri.conf.json` または `capabilities/default.json` で、ローカルファイルへのアクセス権限（`core:path:allow-app-data-recursive` 等）を確認・設定します。
- [ ] **Step 2: `convertFileSrc` によるメディア表示の実装**
`FilePreview.tsx` を刷新。
- 画像 (`.webp`, `.svg`, `.png`, `.jpg` 等): `convertFileSrc(path)` を `src` に設定した `<img>` を表示。
- 動画 (`.mp4`): `<video controls>` を表示。
- 音声 (`.mp3`, `.m4a`): `<audio controls>` を表示。
- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: 画像・動画・音声のマルチメディアプレビュー対応"
```

### Task 4: ユニバーサルデザイン ＆ ポリッシュ

**Files:**
- Modify: `app-file-timemachine/src/components/preview/FilePreview.css`
- Modify: `ハリボテリスト.md`

- [ ] **Step 1: プレビューUIの洗練**
`DESIGN.md` に基づき、フォント設定を徹底。コード表示（`<pre>`）に背景色やパディングを付け、ダーク/ライトどちらでも見やすくします。
- [ ] **Step 2: プレビュー不可時のフォールバック**
どうしてもプレビューできない形式の場合に、ファイル名、サイズ、更新日時、拡張子アイコンを表示する「情報カード」をオシャレに実装。
- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "style: プレビュー機能のユニバーサルデザイン適用と最終調整"
```
