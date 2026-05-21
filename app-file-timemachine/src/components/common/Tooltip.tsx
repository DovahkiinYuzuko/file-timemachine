import { type FC, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import "./Tooltip.css";

interface TooltipProps {
  content: string;
}

/**
 * Accessibility Strategy:
 * - Use useId to generate unique IDs for aria-describedby.
 * - Tooltip container has role="tooltip".
 * - The trigger button uses aria-describedby to link to the tooltip content.
 * - Keyboard focus and mouse hover both trigger the tooltip.
 */
const Tooltip: FC<TooltipProps> = ({ content }) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <div className="tooltip-container">
      <button
        className="tooltip-trigger"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-describedby={tooltipId}
        type="button"
      >
        <HelpCircle size={14} className="tooltip-icon" />
        <span className="sr-only">{t("common.aria.show_help")}</span>
      </button>
      
      {isVisible && (
        <div 
          id={tooltipId}
          className="tooltip-content" 
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
