import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Files, History, Settings, HelpCircle, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import "./Sidebar.css";

export type SidebarTab = "files" | "history" | "settings" | "help";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onOpenFolder: (path: string) => void;
}

/**
 * Accessibility Strategy:
 * - Use <nav> to identify the navigation region.
 * - Use <button> elements for interactive icons.
 * - Each button has an aria-label for screen readers.
 * - aria-pressed indicates the current active state of the tab.
 * - Tooltips or visible labels should ideally be present, but for a "slim" sidebar, 
 *   aria-labels are essential.
 * - Folder selection button is placed at the top for quick access.
 */
const Sidebar: FC<SidebarProps> = ({ activeTab, onTabChange, onOpenFolder }) => {
  const { t } = useTranslation();

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("common.sidebar.open_folder"),
      });
      if (selected && typeof selected === "string") {
        onOpenFolder(selected);
      }
    } catch (error) {
      console.error("Failed to open directory:", error);
    }
  };

  const tabs: { id: SidebarTab; icon: typeof Files; labelKey: string }[] = [
    { id: "files", icon: Files, labelKey: "common.sidebar.files" },
    { id: "history", icon: History, labelKey: "common.sidebar.history" },
    { id: "settings", icon: Settings, labelKey: "common.sidebar.settings" },
    { id: "help", icon: HelpCircle, labelKey: "common.sidebar.help" },
  ];

  return (
    <nav className="sidebar-container" aria-label={t("common.sidebar.files")}>
      <div className="sidebar-top">
        <button
          className="sidebar-item folder-open-btn"
          onClick={handleOpenFolder}
          aria-label={t("common.sidebar.open_folder")}
          title={t("common.sidebar.open_folder")}
        >
          <FolderOpen size={24} strokeWidth={1.5} />
          <span className="sr-only">{t("common.sidebar.open_folder")}</span>
        </button>

        <div className="sidebar-separator" />

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={t(tab.labelKey)}
              aria-pressed={isActive}
              title={t(tab.labelKey)}
            >
              <Icon size={24} strokeWidth={1.5} />
              <span className="sr-only">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Sidebar;
