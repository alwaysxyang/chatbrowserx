import { useState } from 'react';
import type { ChatMessage } from '../../../shared/types/chat';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';

const welcomeMessage: ChatMessage = {
  id: 'chatbrowserx-welcome',
  role: 'assistant',
  content: '你好！我是你的 AI 助手。我可以帮你总结网页内容、解答问题、优化文本等。有什么可以帮助你的吗？',
  createdAt: '10:30',
  status: 'completed',
};

interface ChatPanelProps {
  messages: ChatMessage[];
  isSending: boolean;
  errorMessage: string | null;
  onSendMessage: (input: string) => Promise<string>;
  onClearHistory: () => void;
}

export function ChatPanel({ messages, isSending, errorMessage, onSendMessage, onClearHistory }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const hasHistory = messages.length > 0;

  const submitMessage = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    try {
      setDraft('');
      await onSendMessage(trimmed);
    } catch {}
  };

  const handleSubmit = async () => {
    await submitMessage(draft);
  };

  return (
    <section className="chat-page">
      <div className="chat-surface">
        {hasHistory || isSending ? (
          <MessageList errorMessage={errorMessage} isSending={isSending} messages={hasHistory ? messages : []} />
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-title">你好！我是你的 AI 助手。</div>
            <p className="chat-empty-subtitle">
              我可以帮你总结网页内容、解答问题、优化文本等。有什么可以帮助你的吗？
            </p>
            <div className="chat-suggestions">
              <button
                className="chat-suggestion-pill"
                type="button"
                onClick={() => {
                  void submitMessage('请帮我分析当前网页内容');
                }}
              >
                网站内容分析
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="composer-shell">
        <ChatComposer
          disabled={isSending}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onClear={() => {
            setDraft('');
            onClearHistory();
          }}
        />
      </div>
    </section>
  );
}
