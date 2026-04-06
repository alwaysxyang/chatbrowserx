import { useState } from 'react';
import type { ChatMessage } from '../../../shared/types/chat';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatPanelProps {
  messages: ChatMessage[];
  isSending: boolean;
  errorMessage: string | null;
  streamingContent?: string;
  onSendMessage: (input: string) => Promise<string>;
  onClearHistory: () => void;
  onStop?: () => void;
}

export function ChatPanel({ messages, isSending, errorMessage, streamingContent, onSendMessage, onClearHistory, onStop }: ChatPanelProps) {
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
          <MessageList
            errorMessage={errorMessage}
            isSending={isSending}
            streamingContent={streamingContent}
            messages={hasHistory ? messages : []}
          />
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-title">{translateMessage('chat.empty.title')}</div>
            <p className="chat-empty-subtitle">{translateMessage('chat.empty.subtitle')}</p>
            <div className="chat-suggestions">
              <button
                className="chat-suggestion-pill"
                type="button"
                data-tooltip={translateMessage('chat.suggestion.analyzeTooltip')}
                onClick={() => {
                  void submitMessage(translateMessage('chat.suggestion.analyzeCommand'));
                }}
              >
                {translateMessage('chat.suggestion.analyze')}
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
          isSending={isSending}
          onStop={onStop ?? (() => {})}
        />
      </div>
    </section>
  );
}
