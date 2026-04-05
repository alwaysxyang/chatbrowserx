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
  const displayMessages = messages.length ? messages : [welcomeMessage];

  const handleSubmit = async () => {
    if (!draft.trim() || isSending) {
      return;
    }

    const currentDraft = draft.trim();

    try {
      setDraft('');
      await onSendMessage(currentDraft);
    } catch {}
  };

  return (
    <section className="chat-page">
      <div className="chat-surface">
        <MessageList errorMessage={errorMessage} isSending={isSending} messages={displayMessages} />
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
