import { type FC, useState, useEffect } from "react";
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
  children?: FileEntry[];
}

interface FileTreeProps {
  rootPath: string | null;
  onFileSelect?: (path: string) => void;
}

/**
 * 再帰的に描画される各エントリのコンポーネント
 * 
 * Accessibility:
 * - role="treeitem" を使用
 * - aria-expanded でフォルダの開閉状態を通知
 */
const FileTreeItem: FC<{ 
  entry: FileEntry; 
  depth: number;
  onFileSelect?: (path: string) => void;
}> = ({ entry, depth, onFileSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (entry.is_dir) {
      setIsOpen(!isOpen);
    } else if (onFileSelect) {
      onFileSelect(entry.path);
    }
  };

  return (
    <div className="file-tree-item-wrapper" role="none">
      <div 
        className={`file-tree-item ${entry.is_dir ? "is-directory" : "is-file"}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleToggle}
        role="treeitem"
        aria-expanded={entry.is_dir ? isOpen : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ファイルツリー全体を管理するメインコンポーネント
 * 
 * Accessibility:
 * - role="tree" を使用
 */
const FileTree: FC<FileTreeProps> = ({ rootPath, onFileSelect }) => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTree = async () => {
      if (!rootPath) {
        setTreeData([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      logger.debug(`ファイルツリーの取得を開始: ${rootPath}`);

      try {
        const data = await invoke<FileEntry[]>("get_file_tree", { rootPath });
        setTreeData(data);
        logger.debug(`${data.length} 件のルートエントリを取得したよ！`);
      } catch (err) {
        const errMsg = String(err);
        setError(errMsg);
        logger.error(`ファイルツリーの取得に失敗: ${errMsg}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTree();
  }, [rootPath]);

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
      {treeData.length > 0 ? (
        treeData.map((entry) => (
          <FileTreeItem 
            key={entry.path} 
            entry={entry} 
            depth={0} 
            onFileSelect={onFileSelect}
          />
        ))
      ) : (
        <div className="file-tree-empty">
          <p>{t("common.empty_directory", "ファイルが見つからないよ")}</p>
        </div>
      )}
    </div>
  );
};

export default FileTree;
