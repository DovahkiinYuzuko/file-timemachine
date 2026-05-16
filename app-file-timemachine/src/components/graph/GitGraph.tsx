import { type FC, useEffect, useState } from "react";
import { Gitgraph, TemplateName, templateExtend } from "@gitgraph/react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import "./GitGraph.css";

interface CommitLog {
  hash: String;
  timestamp: number;
  message: String;
}

/**
 * Accessibility Strategy:
 * - The SVG graph is given role="img" and an aria-label describing the commit history.
 * - For screen readers, we provide a hidden textual list of commits as an alternative representation.
 * - Interactive elements (if any) will have proper focus management and keyboard support.
 */

const GitGraph: FC = () => {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<CommitLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // カスタムテンプレート：日本語が綺麗に見えるようにフォントなどを微調整
  const customTemplate = templateExtend(TemplateName.Metro, {
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
    commit: {
      message: {
        displayHash: true,
        font: "normal 12pt 'Segoe UI', 'Meiryo', sans-serif",
      },
    },
  });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // 現在はデモ用にカレントディレクトリのログを取得（パス管理は将来的な課題）
        // TODO: App state からリポジトリパスを取得するように変更
        const logs = await invoke<CommitLog[]>("git_log", { path: "./" });
        setCommits(logs.reverse()); // 古い順に描画するためリバース
      } catch (e) {
        console.error("Failed to fetch logs:", e);
        setError(t("common.error.failed_to_fetch_logs"));
      }
    };

    fetchLogs();
  }, [t]);

  if (error) {
    return <div className="graph-error" role="alert">{error}</div>;
  }

  if (commits.length === 0) {
    return <div className="graph-empty">{t("common.placeholder.no_history")}</div>;
  }

  return (
    <div className="git-graph-wrapper">
      <div
        className="git-graph-svg-container"
        role="img"
        aria-label={t("common.aria.git_graph_description")}
      >
        <Gitgraph template={customTemplate}>
          {(gitgraph: any) => {
            const master = gitgraph.branch("main");
            commits.forEach((commit) => {
              master.commit({
                hash: commit.hash.substring(0, 7),
                subject: commit.message,
                author: "User", // 将来的に取得
                onMessageClick: () => console.log("Commit clicked:", commit.hash),
              });
            });
          }}
        </Gitgraph>
      </div>

      {/* スクリーンリーダー向けの代替表示 */}
      <ul className="sr-only">
        {commits.map((commit) => (
          <li key={commit.hash.toString()}>
            {new Date(commit.timestamp * 1000).toLocaleString()}: {commit.message} ({commit.hash.substring(0, 7)})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GitGraph;
