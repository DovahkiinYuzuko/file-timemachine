import { type FC, useEffect } from "react";
import { X } from "lucide-react";
import "./HelpModal.css";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Accessibility Strategy:
 * - role="dialog" and aria-modal="true" for the modal container.
 * - aria-labelledby points to the modal title.
 * - Trap focus within the modal (simplified here, but Escape key handling is included).
 * - Close button has aria-label.
 */
const HelpModal: FC<HelpModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const gitCommands = [
    { action: "保存", command: "git commit", description: "現在の状態を記録します。" },
    { action: "お試しルート", command: "git branch", description: "新しい作業ラインを作ります。" },
    { action: "切り替える", command: "git checkout", description: "他のルートに移動します。" },
    { action: "採用", command: "git merge", description: "他のルートの変更を取り込みます。" },
    { action: "中身で探す", command: "git grep", description: "全ファイルの中から文字列を検索します。" },
    { action: "同期", command: "git push / pull", description: "クラウド（リモート）と同期します。" },
  ];

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div 
        className="help-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help-modal-header">
          <h2 id="help-modal-title">Gitコマンド早見表</h2>
          <button 
            className="help-modal-close-btn" 
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={24} />
          </button>
        </header>
        
        <div className="help-modal-content">
          <p>
            ファイルタイムマシンの裏側では、世界中のエンジニアが使っている「Git」という仕組みが動いています。
            どの操作がどのコマンドに対応しているか知ることで、より深くファイルを管理できるようになります。
          </p>
          
          <table className="git-commands-table">
            <thead>
              <tr>
                <th>アプリの操作</th>
                <th>Gitコマンド</th>
                <th>説明</th>
              </tr>
            </thead>
            <tbody>
              {gitCommands.map((item, index) => (
                <tr key={index}>
                  <td>{item.action}</td>
                  <td><code>{item.command}</code></td>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="help-modal-footer">
          <button className="help-modal-footer-btn" onClick={onClose}>
            わかった！
          </button>
        </footer>
      </div>
    </div>
  );
};

export default HelpModal;
