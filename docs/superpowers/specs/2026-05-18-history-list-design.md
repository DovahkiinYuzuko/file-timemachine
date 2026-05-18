# 履歴リスト (History List) デザイン仕様書

## 概要
ファイルタイムマシンのコア機能である「履歴リスト」を動的に表示する機能。
「Gitを意識させない」というコンセプトに従い、アプローチA（超シンプル・テーブル）を採用する。

## 1. アーキテクチャ＆コンポーネント
*   **新設コンポーネント**: `src/components/history/HistoryList.tsx`
*   **配置**: `MainLayout` 内の履歴表示用プレースホルダー部分をこれに置き換える。
*   **役割**: `MainLayout` から `projectPath` をPropsとして受け取り、履歴を取得してテーブルで表示する。
*   **UI構造**: `<table>`タグを使用したシンプルな表形式。
    *   **カラム**: 「日時 (Date)」「メッセージ (Message)」「ハッシュ (Hash)」
    *   **ハッシュの表示**: Gitのハッシュはフルではなく、最初の7桁など短縮して表示し、威圧感を減らす。

## 2. データフロー
1.  **トリガー**: `projectPath` が変更された時、または「保存」アクションが完了して履歴が更新された時。
2.  **API呼び出し**: Tauriの `invoke("git_log", { path: projectPath })` を呼び出す。
3.  **状態管理**: 返ってきた `CommitLog[]` データをReactの `useState` (`logs`) にセットする。
4.  **フォーマット**: `timestamp` (UNIX時間) は、ブラウザの `Date` オブジェクトを使用してローカルの分かりやすい日時形式（例：`YYYY/MM/DD HH:mm`）にフォーマットして表示する。

## 3. エラー・空状態のハンドリング
*   **空状態 (0件)**: Gitリポジトリが初期化されたばかりでコミットがない場合は、プレースホルダーではなく `i18n` の `common.placeholder.no_history` キーを使用して「履歴がまだありません」という優しいメッセージを表示する。
*   **エラー状態**: 履歴の取得に失敗した場合（TauriからのErrなど）は、`common.error.failed_to_fetch_logs` の文言を表示し、バックグラウンドでは `logger.error` で詳細なエラーログを記録する。
*   **ローディング**: 取得中は `common.loading` の文言またはスピナーを表示して、処理中であることをユーザーに伝える。

## 4. 依存関係 (Dependencies)
*   `@tauri-apps/api/core` (invoke)
*   `react-i18next` (翻訳用)
*   `src/utils/logger` (ログ記録用)

## 5. Scope Check & Ambiguity (セルフレビュー結果)
*   **Scope**: 履歴の「表示」に特化しており、選択した履歴の詳細（Diff）を見る機能は別フェーズ（間違い探し機能）とする。現状のスコープで適切。
*   **Ambiguity**: 更新トリガーについて、「保存アクション完了時」の検知方法が `MainLayout` 側に依存する。`HistoryList` に更新用のトリガー(例: `refreshKey` prop)を渡すか、イベントリスナーを使用する必要がある。今回はシンプルに `refreshKey: number` をPropsに追加する仕様とする。

## 6. Props Definition (追加)
```typescript
interface HistoryListProps {
  projectPath: string | null;
  refreshKey?: number; // 保存完了時などにインクリメントして再取得をトリガーする
}
```
