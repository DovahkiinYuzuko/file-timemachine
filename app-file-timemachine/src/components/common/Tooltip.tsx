import { type FC, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import "./Tooltip.css";

interface TooltipProps {
  content: string;
  children?: ReactNode;
}

/**
 * Accessibility Strategy:
 * - Use <button> as the trigger for keyboard accessibility.
 * - Use aria-describedby for connecting the trigger with the tooltip content.
 * - Tooltip content is shown on hover and focus.
 */
const Tooltip: FC<TooltipProps> = ({ content, children }) => {
  const tooltipId = `tooltip-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="tooltip-container">
      <button 
        className="tooltip-trigger" 
        aria-describedby={tooltipId}
        type="button"
      >
        {children || <HelpCircle size={16} />}
      </button>
      <div 
        id={tooltipId} 
        className="tooltip-content" 
        role="tooltip"
      >
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
