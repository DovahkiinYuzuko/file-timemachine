import { type FC, useEffect, useState, useRef, MouseEvent, WheelEvent } from "react";
import { createGitgraph, TemplateName, templateExtend } from "@gitgraph/js";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { FolderOpen, History, Loader2, Maximize, Search, X } from "lucide-react";
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
  const [scale, setScale] = useState<number>(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // カメラをリセットする処理
  const handleResetCamera = () => {
    setScale(1.0);
    setOffset({ x: 0, y: 0 });
  };

  const handleZoomBtnClick = (amount: number) => {
    setScale((prev) => {
      const next = prev + amount;
      return Math.min(3.0, Math.max(0.2, next));
    });
  };

  // カスタムテンプレート：日本語が綺麗に見えるようにフォントなどを微調整
  // ズームやパンはCSS transformで行うため、SVGの描画スケールは常に固定 (1.0相当) にします。
  const getTemplate = (style: GraphStyle) => {
    const spacing = 40;  // コミットの縦間隔
    
    // ツリーと路線図のデザイン差別化
    const isTree = style === "tree";
    const dotSize = isTree ? 4 : 6;
    const strokeWidth = isTree ? 1 : 2;
    const lineWidth = isTree ? 2 : 4;
    const branchSpacing = 20; // ブランチの横間隔

    // CUD（岡部・柴田パレット）準拠 of バリアフリー配色（ダークモード用）
    const cudColors = [
      "#56b4e9", // スカイブルー（P型・D型でも視認可能）
      "#e69f00", // オレンジ（高いコントラスト）
      "#009e73", // 青緑（赤緑色盲でも区別しやすい）
      "#cc79a7"  // マゼンタピンク（青・緑と交差してもはっきり区別可能）
    ];

    const baseOptions: any = {
      // ツリー時はシックなモノトーン、路線図時はCUDのカラフル配色で統一
      colors: isTree 
        ? ["#888888", "#aaaaaa", "#cccccc", "#eeeeee"] 
        : cudColors,
      branch: {
        lineWidth: lineWidth,
        spacing: branchSpacing,
        label: {
          display: false, // HTML側で描画するため完全に非表示
        },
      },
      commit: {
        spacing: spacing,
        dot: {
          size: dotSize,
          strokeWidth: strokeWidth,
        },
        message: {
          display: false, // HTML側で描画するため完全に非表示
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
        template: getTemplate(graphStyle),
      });

      const master = gitgraph.branch("main");
      commits.forEach((commit) => {
        master.commit({
          hash: commit.hash.substring(0, 7),
          subject: "", // SVG側のテキスト描画はオフなので空にする
          author: "User", // 将来的に取得
        });
      });
    } catch (e) {
      console.error("Failed to render Git graph:", e);
    }
  }, [commits, graphStyle]);

  // パン操作（ドラッグ移動）のハンドリング
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    if (isDragging) setIsDragging(false);
  };

  // ホイール操作（ズームとパン）のハンドリング
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      // ズーム
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.005;
      
      setScale((prevScale) => {
        const newScale = Math.min(3.0, Math.max(0.2, prevScale + zoomFactor));
        // カーソル位置を基準にズームする処理は複雑になるため、ここでは単純なスケール変更のみとする
        // (transform-origin で中央または左上基準になる)
        return newScale;
      });
    } else {
      // 通常のスクロールはパン移動に変換
      setOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

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
          <p className="empty-title">{t("graph.empty.no_folder_title")}</p>
          <p className="empty-subtitle">
            {t("graph.empty.no_folder_desc")}
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
                  <span>{t("graph.init.loading")}</span>
                </>
              ) : (
                <span>{t("common.action.retry")}</span>
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
          <p className="empty-title">{t("graph.empty.no_history_title")}</p>
          <p className="empty-subtitle">
            {t("graph.empty.no_history_desc")}
          </p>
          <button 
            className="init-button"
            onClick={handleInit}
            disabled={isInitializing}
          >
            {isInitializing ? (
              <>
                <Loader2 className="spinner" size={14} />
                <span>{t("graph.init.loading")}</span>
              </>
            ) : (
              <span>{t("graph.init.start")}</span>
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

        <div className="graph-search-bar" style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: "0 16px", backgroundColor: "var(--bg-color)", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
          <Search size={16} color="var(--text-muted)" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("graph.search.placeholder")}
            style={{ flex: 1, backgroundColor: "transparent", border: "none", color: "var(--text-color)", outline: "none", fontSize: "0.85rem" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="graph-zoom-controls" role="group" aria-label="Zoom controls">
          <button
            className="zoom-btn"
            onClick={() => handleZoomBtnClick(-0.2)}
            disabled={scale <= 0.2}
            title={t("graph.action.zoom_out")}
          >
            -
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button
            className="zoom-btn"
            onClick={() => handleZoomBtnClick(0.2)}
            disabled={scale >= 3.0}
            title={t("graph.action.zoom_in")}
          >
            +
          </button>
          <button
            className="zoom-btn reset-btn"
            onClick={handleResetCamera}
            title={t("graph.action.reset_camera")}
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      <div 
        className={`git-graph-viewport ${isDragging ? "dragging" : ""}`}
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <div 
          className="git-graph-canvas"
          style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0"
          }}
        >
          <div
            ref={containerRef}
            className="git-graph-svg-container"
            role="presentation"
          />
          <div 
            className="git-graph-commit-list"
            role="list"
            aria-label={t("common.aria.git_graph_description")}
          >
            {commits.map((commit, index) => {
              const isMatch = !searchQuery || 
                commit.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                commit.hash.toLowerCase().includes(searchQuery.toLowerCase());

              return (
                <div 
                  key={commit.hash.toString()} 
                  className={`commit-list-row ${!isMatch ? 'faded' : ''}`}
                  style={{ 
                    height: "40px", 
                    opacity: isMatch ? 1 : 0.15,
                    transition: "opacity 0.2s"
                  }}
                  onClick={() => console.log("Commit clicked:", commit.hash)}
                >
                  <div className="commit-info-wrapper">
                    <span className="commit-hash">{commit.hash.substring(0, 7)}</span>
                    {/* 最新のコミットのみ main バッジを表示 */}
                    {index === 0 && <span className="commit-branch-badge">main</span>}
                    <span className="commit-message" title={commit.message}>{commit.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitGraph;