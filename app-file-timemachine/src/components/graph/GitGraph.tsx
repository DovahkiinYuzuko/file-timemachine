import { type FC, useEffect, useState } from "react";
import { Gitgraph, TemplateName, templateExtend, type TemplateOptions } from "@gitgraph/react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { GitBranch, Route } from "lucide-react";
import "./GitGraph.css";

interface CommitLog {
  hash: string;
  timestamp: number;
  message: string;
}

type GraphStyle = "tree" | "metro";

/**
 * Accessibility Strategy:
 * - The SVG graph is given role="img" and an aria-label describing the commit history.
 * - For screen readers, we provide a hidden textual list of commits as an alternative representation.
 * - Interactive elements (toggle buttons) use semantic <button> tags with visual 'active' states.
 */

const GitGraph: FC = () => {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<CommitLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("metro");

  // カスタムテンプレート：日本語が綺麗に見えるようにフォントなどを微調整
  const getTemplate = (style: GraphStyle) => {
    const baseOptions: TemplateOptions = {
      colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
      commit: {
        message: {
          displayHash: true,
          font: "normal 12pt 'Segoe UI', 'Meiryo', sans-serif",
        },
      },
    };

    if (style === "tree") {
      // ツリー形式（標準的な丸みのあるデザイン）
      return templateExtend(TemplateName.BlackArrow, baseOptions);
    } else {
      // 路線図形式（直線的なデザイン）
      return templateExtend(TemplateName.Metro, baseOptions);
    }
  };

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
      <div className="git-graph-header">
        <div className="graph-style-toggle" role="group" aria-label="Graph display style">
          <button
            className={`toggle-btn ${graphStyle === "tree" ? "active" : ""}`}
            onClick={() => setGraphStyle("tree")}
            aria-pressed={graphStyle === "tree"}
          >
            {t("common.graph_style.tree")}
          </button>
          <button
            className={`toggle-btn ${graphStyle === "metro" ? "active" : ""}`}
            onClick={() => setGraphStyle("metro")}
            aria-pressed={graphStyle === "metro"}
          >
            {t("common.graph_style.metro")}
          </button>
        </div>
      </div>

      <div
        className="git-graph-svg-container"
        role="img"
        aria-label={t("common.aria.git_graph_description")}
      >
        <Gitgraph template={getTemplate(graphStyle)}>
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

export default GitGraph;mmit.hash.substring(0, 7)})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GitGraph;