import { Check, Copy } from 'lucide-react';
import { translateMessage } from '../../../shared/i18n/i18n';
import { MessageMarkdown } from '../../shared/MessageMarkdown';

interface SelectionBubblePanelProps {
  content: string;
  isCopied: boolean;
  onCopy: () => void;
  onCopyReset: () => void;
}

/**
 * Renders streaming selection output and copy feedback.
 *
 * @param props - Panel content and copy command state.
 * @returns The selection result panel.
 */
export function SelectionBubblePanel({ content, isCopied, onCopy, onCopyReset }: SelectionBubblePanelProps) {
  return (
    <div className="selection-panel" role="dialog" aria-label="Selection result">
      <div className="selection-panel-body">
        <MessageMarkdown content={content || translateMessage('chat.loading')} />
      </div>
      <div className="selection-panel-divider" />
      <div className="selection-panel-footer">
        <button
          type="button"
          className="selection-copy-button"
          aria-label={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
          data-tooltip={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
          onMouseLeave={onCopyReset}
          onClick={onCopy}
        >
          {isCopied ? (
            <Check className="h-3 w-3 selection-copy-icon-success" strokeWidth={2.2} />
          ) : (
            <Copy className="h-3 w-3" strokeWidth={2.0} />
          )}
        </button>
      </div>
    </div>
  );
}
