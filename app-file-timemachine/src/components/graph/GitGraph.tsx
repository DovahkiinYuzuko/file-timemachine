import { type FC, useEffect, useState, useRef } from "react";
import { createGitgraph, TemplateName, templateExtend } from "@gitgraph/js";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { FolderOpen, History, Loader2 } from "lucide-react";
import "./GitGraph.css";

interface CommitLog {
  hash: string;
  timestamp: number;
  message: string;
}

type GraphStyle = "tree" | "metro";

interface GitGraphProps {
  projectPath: string | null;
  refreshKey?: number;
  onInitSuccess?: () => void;
}

/**
 * Accessibility Strategy:
 * - The SVG graph is given role="img" and an aria-label describing the commit history.
 * - For screen readers, we provide a hidden textual list of commits as an alternative representation.
 * - Interactive elements (toggle buttons) use semantic <button> tags with visual 'active' states.
 */

const GitGraph: FC<GitGraphProps> = ({ projectPath, refreshKey, onInitSuccess }) => {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<CommitLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("metro");
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(0.8); // デフォルトを0.8にしてコンパクトに表示
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoom = (amount: number) => {
    setScale((prev) => {
      const next = parseFloat((prev + amount).toFixed(1));
      return Math.min(2.0, Math.max(0.4, next));
    });
  };

  // カスタムテンプレート：日本語が綺麗に見えるようにフォントなどを微調整
  // CUD（色覚バリアフリー）カラーパレットを適用し、ズームレベル(scale)に連動させます
  const getTemplate = (style: GraphStyle, currentScale: number) => {
    // 基準値にスケールを適用
    const fontSize = Math.max(9, Math.round(13 * currentScale)); // 最小9px
    const dotSize = Math.max(4, Math.round(5 * currentScale));   // 最小4px
    const strokeWidth = Math.max(1, Math.round(2 * currentScale));
    const lineWidth = Math.max(2, Math.round(3 * currentScale));
    const spacing = Math.max(15, Math.round(26 * currentScale));  // コミット間隔
    const branchSpacing = Math.max(15, Math.round(22 * currentScale)); // ブランチ間隔

    // CUD（岡部・柴田パレット）準拠のバリアフリー配色（ダークモード用）
    const cudColors = [
      "#56b4e9", // スカイブルー（P型・D型でも視認可能）
      "#e69f00", // オレンジ（高いコントラスト）
      "#009e73", // 青緑（赤緑色盲でも区別しやすい）
      "#cc79a7"  // マゼンタピンク（青・緑と交差してもはっきり区別可能）
    ];

    const baseOptions: any = {
      // ツリー時はシックなモノトーン、路線図時はCUDのカラフル配色で統一
      colors: style === "tree" 
        ? ["#888888", "#aaaaaa", "#cccccc", "#eeeeee"] 
        : cudColors,
      branch: {
        lineWidth: lineWidth,
        spacing: branchSpacing,
      },
      commit: {
        spacing: spacing,
        dot: {
          size: dotSize,
          strokeWidth: strokeWidth,
        },
        message: {
          displayHash: true,
          font: `normal ${fontSize}px 'Segoe UI', 'Yu Gothic UI', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif`,
        },
      },
    };

    // ツリーと路線図の両方で TemplateName.Metro ベースに統一して野暮ったい黒矢印を廃止！
    return templateExtend(TemplateName.Metro, baseOptions);
  };

  // 履歴データの取得
  useEffect(() => {
    const fetchLogs = async () => {
      if (!projectPath) {
        setCommits([]);
        setError(null);
        return;
      }
      try {
        const logs = await invoke<CommitLog[]>("git_log", { path: projectPath });
        // logs はイミュータブルに扱うため、シャローコピーを作成してから reverse を実行します
        setCommits([...logs].reverse()); // 古い順に描画するためリバース
        setError(null);
      } catch (e) {
        console.error("Failed to fetch logs:", e);
        setError(t("common.error.failed_to_fetch_logs"));
      }
    };

    fetchLogs();
  }, [projectPath, refreshKey, t]);

  // @gitgraph/js によるマニュアルDOMレンダリング
  // StrictMode 等の二重レンダリングによる重複を防ぐため、毎回のレンダリング前に DOM をクリアします
  useEffect(() => {
    if (!containerRef.current || commits.length === 0) return;

    // 前回の描画内容をクリア
    containerRef.current.innerHTML = "";

    try {
      const gitgraph = createGitgraph(containerRef.current, {
        template: getTemplate(graphStyle, scale),
      });

      const master = gitgraph.branch("main");
      commits.forEach((commit) => {
        master.commit({
          hash: commit.hash.substring(0, 7),
          subject: commit.message,
          author: "User", // 将来的に取得
          onMessageClick: () => console.log("Commit clicked:", commit.hash),
        });
      });
    } catch (e) {
      console.error("Failed to render Git graph:", e);
    }
  }, [commits, graphStyle, scale]);

  const handleInit = async () => {
    if (!projectPath) return;

    setIsInitializing(true);
    setError(null);

    try {
      // 1. git init を実行
      await invoke("git_init", { path: projectPath });
      
      // 2. 初回コミットを実行
      const commitMsg = t("common.placeholder.initial_commit_msg", { defaultValue: "最初の保存" }) || "最初の保存";
      await invoke("git_commit", { path: projectPath, message: commitMsg });

      // 3. 成功時のコールバック呼び出し
      if (onInitSuccess) {
        onInitSuccess();
      }
    } catch (e) {
      console.error("Failed to initialize repository:", e);
      setError(t("common.error.failed_to_initialize") || "初期化に失敗しました");
    } finally {
      setIsInitializing(false);
    }
  };

  if (!projectPath) {
    return (
      <div className="git-graph-wrapper empty-state">
        <div className="empty-message-container">
          <FolderOpen className="empty-icon" size={24} />
          <p className="empty-title">フォルダが選択されていません</p>
          <p className="empty-subtitle">
            サイドバーの「フォルダを開く」からプロジェクトを選択すると、ここに履歴の路線図が表示されます。
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="git-graph-wrapper">
        <div className="graph-error" role="alert">
          <p>{error}</p>
          {error.includes("failed_to_initialize") || error.includes("失敗") ? (
            <button 
              className="init-button"
              onClick={handleInit}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <>
                  <Loader2 className="spinner" size={14} />
                  <span>初期化中...</span>
                </>
              ) : (
                <span>再試行する</span>
              )}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="git-graph-wrapper empty-state">
        <div className="empty-message-container">
          <History className="empty-icon" size={24} />
          <p className="empty-title">履歴が見つかりませんでした</p>
          <p className="empty-subtitle">
            タイムマシンの履歴（コミット）を記録するために、リポジトリの初期化を実行してください。
          </p>
          <button 
            className="init-button"
            onClick={handleInit}
            disabled={isInitializing}
          >
            {isInitializing ? (
              <>
                <Loader2 className="spinner" size={14} />
                <span>初期化中...</span>
              </>
            ) : (
              <span>履歴の保存を開始する</span>
            )}
          </button>
        </div>
      </div>
    );
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

        <div className="graph-zoom-controls" role="group" aria-label="Zoom controls">
          <button
            className="zoom-btn"
            onClick={() => handleZoom(-0.1)}
            disabled={scale <= 0.4}
            title="ズームアウト"
          >
            -
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button
            className="zoom-btn"
            onClick={() => handleZoom(0.1)}
            disabled={scale >= 2.0}
            title="ズームイン"
          >
            +
          </button>
          <button
            className="zoom-btn reset-btn"
            onClick={() => setScale(0.8)}
            title="ズームリセット"
          >
            ↺
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="git-graph-svg-container"
        role="img"
        aria-label={t("common.aria.git_graph_description")}
      />

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