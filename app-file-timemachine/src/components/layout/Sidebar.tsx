import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Files, History, Settings, HelpCircle } from "lucide-react";
import "./Sidebar.css";

export type SidebarTab = "files" | "history" | "settings" | "help";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/**
 * Accessibility Strategy:
 * - Use <nav> to identify the navigation region.
 * - Use <button> elements for interactive icons.
 * - Each button has an aria-label for screen readers.
 * - aria-pressed indicates the current active state of the tab.
 * - Tooltips or visible labels should ideally be present, but for a "slim" sidebar, 
 *   aria-labels are essential.
 */
const Sidebar: FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs: { id: SidebarTab; icon: typeof Files; labelKey: string }[] = [
    { id: "files", icon: Files, labelKey: "common.sidebar.files" },
    { id: "history", icon: History, labelKey: "common.sidebar.history" },
    { id: "settings", icon: Settings, labelKey: "common.sidebar.settings" },
    { id: "help", icon: HelpCircle, labelKey: "common.sidebar.help" },
  ];

  return (
    <nav className="sidebar-container" aria-label={t("common.sidebar.files")}>
      <div className="sidebar-top">
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
