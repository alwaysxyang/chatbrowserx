import { Languages, Sparkles } from 'lucide-react';
import type { SelectionMode } from '../../../shared/types/selection';
import { translateMessage } from '../../../shared/i18n/i18n';

interface SelectionBubbleToolbarProps {
  disabled: boolean;
  onRun: (mode: SelectionMode) => void;
}

/**
 * Renders the Translate and Ask AI actions for the current page selection.
 *
 * @param props - Toolbar command state and handlers.
 * @returns The selection action toolbar.
 */
export function SelectionBubbleToolbar({ disabled, onRun }: SelectionBubbleToolbarProps) {
  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selection toolbar">
      <button
        type="button"
        className="selection-toolbar-button"
        disabled={disabled}
        onClick={() => onRun('translate')}
      >
        <Languages className="selection-toolbar-icon" strokeWidth={2.1} />
        <span>{translateMessage('selection.toolbar.translate')}</span>
      </button>
      <button
        type="button"
        className="selection-toolbar-button"
        disabled={disabled}
        onClick={() => onRun('ask_ai')}
      >
        <Sparkles className="selection-toolbar-icon" strokeWidth={2.1} />
        <span>{translateMessage('selection.toolbar.askAi')}</span>
      </button>
    </div>
  );
}
