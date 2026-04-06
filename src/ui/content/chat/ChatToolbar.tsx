import { Paperclip, Scissors, Send, Square, Trash2 } from 'lucide-react';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatToolbarProps {
  disabled: boolean;
  canSend: boolean;
  onClear: () => void;
  isSending: boolean;
  onStop: () => void;
}

export function ChatToolbar({ disabled, canSend, onClear, isSending, onStop }: ChatToolbarProps) {
  return (
    <div className="chat-toolbar">
      <div className="chat-toolbar-group chat-toolbar-group-left">
        <button
          className="chat-toolbar-button"
          type="button"
          aria-label={translateMessage('chat.toolbar.screenshotLabel')}
          data-tooltip={translateMessage('chat.toolbar.screenshotTooltip')}
          disabled
        >
          <Scissors className="chat-toolbar-icon chat-toolbar-icon-scissors" strokeWidth={2.2} />
        </button>
        <span className="chat-toolbar-divider" aria-hidden="true" />
        <button
          className="chat-toolbar-button"
          type="button"
          aria-label={translateMessage('chat.toolbar.attachmentLabel')}
          data-tooltip={translateMessage('chat.toolbar.attachmentTooltip')}
          disabled
        >
          <Paperclip className="chat-toolbar-icon" strokeWidth={2.2} />
        </button>
      </div>

      <div className="chat-toolbar-group chat-toolbar-group-right">
        <button
          className="chat-toolbar-button chat-toolbar-button-danger"
          type="button"
          aria-label={translateMessage('chat.toolbar.clearLabel')}
          data-tooltip={translateMessage('chat.toolbar.clearTooltip')}
          onClick={onClear}
        >
          <Trash2 className="chat-toolbar-icon" strokeWidth={2.2} />
        </button>
        <span className="chat-toolbar-divider" aria-hidden="true" />
        {isSending ? (
          <button
            className="chat-toolbar-send chat-toolbar-send-stop"
            type="button"
            data-tooltip={translateMessage('chat.toolbar.stopTooltip')}
            aria-label={translateMessage('chat.toolbar.stopLabel')}
            onClick={onStop}
          >
            <Square className="chat-toolbar-send-icon" strokeWidth={2.3} />
            <span className="visually-hidden">{translateMessage('chat.toolbar.stopLabel')}</span>
          </button>
        ) : (
          <button
            className="chat-toolbar-send"
            data-tooltip={
              disabled || !canSend
                ? translateMessage('chat.toolbar.sendTooltipDisabled')
                : translateMessage('chat.toolbar.sendTooltipEnabled')
            }
            disabled={disabled || !canSend}
            type="submit"
          >
            <Send className="chat-toolbar-send-icon" strokeWidth={2.3} />
            <span className="visually-hidden">{translateMessage('chat.toolbar.sendLabel')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
