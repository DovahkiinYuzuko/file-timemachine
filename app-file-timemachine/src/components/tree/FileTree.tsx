import { type FC, useState, useEffect, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, FileText, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import logger from "../../utils/logger";
import "./FileTree.css";

/**
 * Rust側の FileEntry 構造体に対応するTypeScript型
 */
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_ignored: boolean;
  children?: FileEntry[];
}

export type GitMode = "whitelist" | "blacklist";

export interface ProjectConfig {
  git_mode: GitMode;
}

interface FileTreeProps {
  rootPath: string | null;
  onFileSelect?: (path: string) => void;
}

/**
 * 再帰的に描画される各エントリのコンポーネント
 */
const FileTreeItem: FC<{ 
  entry: FileEntry; 
  depth: number;
  onFileSelect?: (path: string) => void;
  onToggleIgnore: (path: string, currentIgnored: boolean) => void;
}> = memo(({ entry, depth, onFileSelect, onToggleIgnore }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    // チェックボックスをクリックした時は無視
    if ((e.target as HTMLElement).classList.contains("item-checkbox")) {
      return;
    }

    if (entry.is_dir) {
      setIsOpen(!isOpen);
    } else if (onFileSelect) {
      onFileSelect(entry.path);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleIgnore(entry.path, entry.is_ignored);
  };

  return (
    <div className="file-tree-item-wrapper" role="none">
      <div 
        className={`file-tree-item ${entry.is_dir ? "is-directory" : "is-file"} ${entry.is_ignored ? "is-ignored" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleToggle}
        role="treeitem"
        aria-expanded={entry.is_dir ? isOpen : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle(e);
          }
        }}
      >
        <span className="item-icon-wrapper">
          {entry.is_dir ? (
            <>
              {isOpen ? <ChevronDown size={14} className="chevron" /> : <ChevronRight size={14} className="chevron" />}
              <Folder size={16} className="folder-icon" />
            </>
          ) : (
            <>
              <span className="chevron-spacer" />
              <FileText size={16} className="file-icon" />
            </>
          )}
        </span>
        <input 
          type="checkbox" 
          className="item-checkbox" 
          checked={!entry.is_ignored} 
          onChange={() => {}} // onClickで制御
          onClick={handleCheckboxClick}
          aria-label={entry.is_ignored ? "無視を解除" : "無視する"}
        />
        <span className="item-name">{entry.name}</span>
      </div>

      {entry.is_dir && isOpen && entry.children && (
        <div className="file-tree-children" role="group">
          {entry.children.map((child) => (
            <FileTreeItem 
              key={child.path} 
              entry={child} 
              depth={depth + 1} 
              onFileSelect={onFileSelect}
              onToggleIgnore={onToggleIgnore}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * ファイルツリー全体を管理するメインコンポーネント
 */
const FileTree: FC<FileTreeProps> = ({ rootPath, onFileSelect }) => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitMode, setGitMode] = useState<GitMode>("blacklist");

  const fetchTree = async () => {
    if (!rootPath) {
      setTreeData([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke<FileEntry[]>("get_file_tree", { rootPath });
      setTreeData(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfig = async () => {
    if (!rootPath) return;
    try {
      const config = await invoke<ProjectConfig>("get_project_config", { rootPath });
      setGitMode(config.git_mode);
    } catch (err) {
      logger.error(`Failed to fetch project config: ${err}`);
    }
  };

  useEffect(() => {
    fetchTree();
    fetchConfig();
  }, [rootPath]);

  const handleToggleMode = async () => {
    if (!rootPath) return;
    const newMode = gitMode === "whitelist" ? "blacklist" : "whitelist";
    try {
      await invoke("set_project_config", { 
        rootPath, 
        config: { git_mode: newMode } 
      });
      setGitMode(newMode);
      logger.info(`Git mode changed to ${newMode}`);
      fetchTree(); // モード変更後にツリーを再取得
    } catch (err) {
      logger.error(`Failed to update git mode: ${err}`);
    }
  };

  const handleToggleIgnore = async (targetPath: string, currentIgnored: boolean) => {
    if (!rootPath) return;
    try {
      // 逆の状態にする
      await invoke("update_gitignore", { 
        rootPath, 
        targetPath, 
        isIgnored: !currentIgnored,
        mode: gitMode
      });
      logger.info(`Updated ignore state for ${targetPath}`);
      // 再取得して反映
      fetchTree();
    } catch (err) {
      logger.error(`Failed to update gitignore: ${err}`);
    }
  };

  if (!rootPath) {
    return (
      <div className="file-tree-placeholder">
        <p>{t("common.placeholder.file_tree")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="file-tree-status">
        <Loader2 className="animate-spin" size={20} />
        <span>{t("common.loading", "読み込み中...")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-tree-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="file-tree-container" role="tree" aria-label={t("common.file_tree")}>
      <div className="file-tree-header">
        <span className="header-title">{t("common.file_tree")}</span>
        <div 
          className={`git-mode-badge ${gitMode}`}
          onClick={handleToggleMode}
          title={t("common.git_mode.tooltip")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggleMode();
            }
          }}
        >
          <span className="mode-label">{t("common.git_mode.label")}:</span>
          <span className="mode-value">{t(`common.git_mode.${gitMode}`)}</span>
        </div>
      </div>
      
      <div className="file-tree-scroll-area">
        {treeData.length > 0 ? (
          treeData.map((entry) => (
            <FileTreeItem 
              key={entry.path} 
              entry={entry} 
              depth={0} 
              onFileSelect={onFileSelect}
              onToggleIgnore={handleToggleIgnore}
            />
          ))
        ) : (
          <div className="file-tree-empty">
            <p>{t("common.empty_directory", "ファイルが見つからないよ")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTree;
