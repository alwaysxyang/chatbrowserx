import { Paperclip, Scissors, Send, Trash2 } from 'lucide-react';

interface ChatToolbarProps {
  disabled: boolean;
  canSend: boolean;
  onClear: () => void;
}

export function ChatToolbar({ disabled, canSend, onClear }: ChatToolbarProps) {
  return (
    <div className="chat-toolbar">
      <div className="chat-toolbar-group chat-toolbar-group-left">
        <button
          className="chat-toolbar-button"
          type="button"
          aria-label="截图（占位）"
          data-tooltip="截图（开发中）"
          disabled
        >
          <Scissors className="chat-toolbar-icon chat-toolbar-icon-scissors" strokeWidth={2.2} />
        </button>
        <span className="chat-toolbar-divider" aria-hidden="true" />
        <button
          className="chat-toolbar-button"
          type="button"
          aria-label="上传附件（占位）"
          data-tooltip="上传附件（开发中）"
          disabled
        >
          <Paperclip className="chat-toolbar-icon" strokeWidth={2.2} />
        </button>
      </div>

      <div className="chat-toolbar-group chat-toolbar-group-right">
        <button
          className="chat-toolbar-button chat-toolbar-button-danger"
          type="button"
          aria-label="清空聊天记录"
          data-tooltip="清空聊天记录"
          onClick={onClear}
        >
          <Trash2 className="chat-toolbar-icon" strokeWidth={2.2} />
        </button>
        <span className="chat-toolbar-divider" aria-hidden="true" />
        <button
          className="chat-toolbar-send"
          data-tooltip={disabled || !canSend ? '输入内容后可发送' : '发送消息'}
          disabled={disabled || !canSend}
          type="submit"
        >
          <Send className="chat-toolbar-send-icon" strokeWidth={2.3} />
          <span className="visually-hidden">发送</span>
        </button>
      </div>
    </div>
  );
}
