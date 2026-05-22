// app-file-timemachine/src/components/history/HistoryList.tsx
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import logger from "../../utils/logger";
import type { CommitLog } from "../../types/git";
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
        logger.debug(`履歴を取得します: ${projectPath}`);
        const result = await invoke<CommitLog[]>("git_log", { path: projectPath });
        if (isMounted) {
          setLogs(result);
          logger.info(`履歴を ${result.length} 件取得しました。`);
        }
      } catch (e) {
        logger.error(`履歴の取得に失敗しました: ${e}`);
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

  return (
    // [Accessibility Strategy] スクリーンリーダーにこのコンテナの役割を正しく伝えるため、aria-label を設定しています。
    <div className="history-list-container" aria-label={t("common.history_list")}>
      {/* [Accessibility Strategy] テーブルのデータ構造をセマンティックに伝え、スクリーンリーダーでのナビゲーションを可能にするため、ネイティブの table 要素を使用しています。 */}
      <table className="history-table">
        <thead>
          <tr>
            <th>{t("common.last_modified")}</th>
            <th>{t("history.table.message")}</th>
            <th>{t("history.table.hash")}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const isSelected = selectedCommitHash === log.hash;
            return (
              <tr 
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
