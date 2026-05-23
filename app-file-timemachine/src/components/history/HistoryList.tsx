// app-file-timemachine/src/components/history/HistoryList.tsx
import { type FC, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ArrowDown, ArrowUp } from "lucide-react";
import logger from "../../utils/logger";
import type { CommitLog } from "../../types/git";
import { getAppConfig, updateAppConfig } from "../../api/config";
import "./HistoryList.css";

interface HistoryListProps {
  projectPath: string | null;
  refreshKey?: number;
  selectedCommitHash: string | null;
  onCommitSelect: (hash: string | null) => void;
}

const HistoryList: FC<HistoryListProps> = ({ projectPath, refreshKey = 0, selectedCommitHash, onCommitSelect }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<CommitLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState<boolean>(false); // デフォルトを「古い順（一番下が最新）」にする要望に合わせて false に
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectPath) {
      setLogs([]);
      return;
    }

    let isMounted = true;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        logger.debug(`Fetching commit history: ${projectPath}`);
        const result = await invoke<CommitLog[]>("git_log", { path: projectPath });
        if (isMounted) {
          setLogs(result);
          logger.info(`Retrieved ${result.length} history records.`);

          // スクロール位置とソート状態の復元
          setTimeout(async () => {
            try {
              const config = await getAppConfig();
              if (config.project_positions && config.project_positions[projectPath]) {
                const pos = config.project_positions[projectPath];
                if (pos.history_list_sort_desc != null) {
                  setSortDesc(pos.history_list_sort_desc);
                }
                if (pos.history_list_scroll_y != null && containerRef.current) {
                  containerRef.current.scrollTop = pos.history_list_scroll_y;
                }
              }
            } catch (err) {
              console.error("Failed to restore history state:", err);
            }
          }, 0);
        }
      } catch (e) {
        logger.error(`Failed to fetch history: ${e}`);
        if (isMounted) {
          setError(String(e));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, [projectPath, refreshKey]);

  // 外部からの選択変更時に自動スクロール
  useEffect(() => {
    if (selectedCommitHash && containerRef.current) {
      const el = document.getElementById(`history-row-${selectedCommitHash}`);
      if (el) {
        // center にすると対象が見やすくなる
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedCommitHash, sortDesc]);

  // スクロール位置の保存 (debounce)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !projectPath || logs.length === 0) return;

    let timeoutId: number | null = null;

    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        try {
          const config = await getAppConfig();
          const positions = config.project_positions || {};
          const currentPos = positions[projectPath] || {};
          const scrollY = container.scrollTop;
          
          if (currentPos.history_list_scroll_y === scrollY) return;

          await updateAppConfig({
            project_positions: {
              ...positions,
              [projectPath]: {
                ...currentPos,
                history_list_scroll_y: scrollY,
              }
            }
          });
        } catch (err) {
          console.error("Failed to save history scroll position:", err);
        }
      }, 500);
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [projectPath, logs.length]);

  const handleSortToggle = async () => {
    const newSortDesc = !sortDesc;
    setSortDesc(newSortDesc);
    if (!projectPath) return;
    try {
      const config = await getAppConfig();
      const positions = config.project_positions || {};
      const currentPos = positions[projectPath] || {};
      await updateAppConfig({
        project_positions: {
          ...positions,
          [projectPath]: {
            ...currentPos,
            history_list_sort_desc: newSortDesc,
          }
        }
      });
    } catch (err) {
      console.error("Failed to save sort state:", err);
    }
  };

  const formatDate = (timestamp: number) => {
    // Rust側が秒単位のUNIXタイムスタンプを返す前提
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  if (isLoading) {
    return <div className="history-empty">{t("common.loading")}</div>;
  }

  if (error) {
    return <div className="history-error">{t("common.error.failed_to_fetch_logs")}</div>;
  }

  if (logs.length === 0) {
    return <div className="history-empty">{t("common.placeholder.no_history")}</div>;
  }

  const displayedLogs = sortDesc ? logs : [...logs].reverse();

  return (
    // [Accessibility Strategy] スクリーンリーダーにこのコンテナの役割を正しく伝えるため、aria-label を設定しています。
    <div 
      className="history-list-container" 
      aria-label={t("common.history_list")}
      ref={containerRef}
    >
      {/* [Accessibility Strategy] テーブルのデータ構造をセマンティックに伝え、スクリーンリーダーでのナビゲーションを可能にするため、ネイティブの table 要素を使用しています。 */}
      <table className="history-table">
        <thead>
          <tr>
            <th 
              onClick={handleSortToggle} 
              style={{ cursor: "pointer", userSelect: "none" }}
              title={sortDesc ? "新しい順" : "古い順"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {t("common.last_modified")}
                {sortDesc ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              </div>
            </th>
            <th>{t("history.table.message")}</th>
            <th>{t("history.table.hash")}</th>
          </tr>
        </thead>
        <tbody>
          {displayedLogs.map((log) => {
            const isSelected = selectedCommitHash === log.hash;
            return (
              <tr 
                id={`history-row-${log.hash}`}
                key={log.hash}
                className={isSelected ? "selected" : ""}
                onClick={() => {
                  if (isSelected) {
                    onCommitSelect(null);
                  } else {
                    onCommitSelect(log.hash);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <td className="history-date">{formatDate(log.timestamp)}</td>
                <td className="history-message">{log.message}</td>
                <td className="history-hash">{log.hash.substring(0, 7)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryList;
