# ファイルタイムマシン 実装プラン (v2: ハイブリッド)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** デザイン v2（サイドバー付きハイブリッドUI、主要15言語、GitHub OAuth、ヘルプシステム）を実装し、製品の完成度を究極に高める。

**Architecture:** 
- **Frontend**: `Sidebar` + 3カラムの `MainLayout`（`react-resizable-panels` 活用）。
- **i18n**: 15言語の辞書ファイルを完備し、RTL対応も考慮。
- **Auth**: `tauri-plugin-shell` を使用して GitHub OAuth フローを実装。
- **Help**: モーダル形式の `GitCheatSheet` と `Tooltip` コンポーネント。

---

### Task 1: ハイブリッドUIへのレイアウト刷新

**Files:**
- Modify: `app-file-timemachine/src/components/layout/MainLayout.tsx`
- Create: `app-file-timemachine/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: `Sidebar` コンポーネントの作成**
Lucideアイコン（Files, History, Settings, HelpCircle）を並べたスリムなサイドバーを作成する。

- [ ] **Step 2: `MainLayout` の3カラム化と上下分割の実装**
既存の4カラムを3カラムに統合。中央カラムを上下に分け、上に `GitGraph`、下に `HistoryList` を配置する。

- [ ] **Step 3: スタイルの調整 (Flex/Grid)**
サイドバーとパネルグループが正しく全画面に収まるようにCSSを修正。

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat: サイドバー付きハイブリッドUIレイアウトの実装"
```

### Task 2: 究極の15言語多言語化対応

**Files:**
- Create/Update: `app-file-timemachine/public/locales/{lang}/translation.json` (15言語)
- Modify: `app-file-timemachine/src/i18n/config.ts`

- [ ] **Step 1: 15言語分の翻訳ファイル作成**
（日、英、中、韓、タイ、ベトナム、インドネシア、西、仏、独、葡、伊、露、アラビア、ヒンディー）

- [ ] **Step 2: RTL (Right-to-Left) 対応の基礎実装**
言語設定がアラビア語の場合に `document.dir = 'rtl'` を設定するロジックを `App.tsx` 等に追加。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: 15言語のグローバル多言語対応とRTL対応の追加"
```

### Task 3: 拡張設定画面と GitHub OAuth 連携

**Files:**
- Create: `app-file-timemachine/src/components/settings/SettingsModal.tsx`
- Modify: `app-file-timemachine/src-tauri/src/lib.rs` (Shell API check)

- [ ] **Step 1: 設定モーダルのUI作成**
言語選択、GitHub連携ボタン、自動保存設定、脆弱性スキャンON/OFF。

- [ ] **Step 2: GitHub OAuth 認証フローの実装**
`@tauri-apps/plugin-shell` を使い、ボタンクリックでブラウザの認証ページを開く処理。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: 拡張設定画面とGitHub OAuth連携の基盤実装"
```

### Task 4: ダブル・ヘルプ・システム（早見表 ＆ ツールチップ）

**Files:**
- Create: `app-file-timemachine/src/components/help/HelpModal.tsx`
- Create: `app-file-timemachine/src/components/common/Tooltip.tsx`

- [ ] **Step 1: Gitコマンド早見表モーダルの実装**
アプリ操作とGitコマンドの対応表をテーブル形式で作成。

- [ ] **Step 2: 各ボタンへのツールチップ適用**
Lucideの `HelpCircle` を使ったミニ解説ツールチップをUIの各所に配置。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: Git早見表とツールチップによるヘルプシステムの実装"
```

### Task 5: 最終統合と磨き上げ

**Files:**
- Modify: `app-file-timemachine/src/App.tsx`
- Modify: `app-file-timemachine/src-tauri/tauri.conf.json`

- [ ] **Step 1: 全コンポーネントのステート連携**
サイドバーでの表示切り替え、設定の永続化、言語の動的反映。

- [ ] **Step 2: セキュリティ (CSP) の設定**
`tauri.conf.json` に適切なContent Security Policyを追加。

- [ ] **Step 3: Commit**
```bash
git add .
git commit -m "feat: プロジェクト全体の最終統合とセキュリティ強化"
```
