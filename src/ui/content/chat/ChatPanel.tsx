import { useState } from 'react';
import type { ChatMessage, ChatMessageContent } from '../../../shared/types/chat';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';
import { buildComposerContent } from './chat-composer-content';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatPanelProps {
  messages: ChatMessage[];
  isSending: boolean;
  onSendMessage: (input: ChatMessageContent) => Promise<void>;
  onClearHistory: () => void;
  onStop?: () => void;
  onStartScreenshot?: (onCaptured: (dataUrl: string) => void) => void;
  onPreviewImage?: (src: string) => void;
}

export function ChatPanel({
  messages,
  isSending,
  onSendMessage,
  onClearHistory,
  onStop,
  onStartScreenshot,
  onPreviewImage,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const hasHistory = messages.length > 0;

  const submitMessage = async (input: string, pendingImages: string[] = []) => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingImages.length) || isSending) {
      return;
    }

    try {
      setDraft('');
      setImageUrls([]);
      await onSendMessage(buildComposerContent(trimmed, pendingImages));
    } catch {}
  };

  const handleSubmit = async () => {
    await submitMessage(draft, imageUrls);
  };

  return (
    <section className="chat-page">
      <div className="chat-surface">
        {hasHistory || isSending ? (
          <MessageList isSending={isSending} messages={hasHistory ? messages : []} onPreviewImage={onPreviewImage} />
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
          imageUrls={imageUrls}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onClear={() => {
            setDraft('');
            setImageUrls([]);
            onClearHistory();
          }}
          onRemoveImage={(index) => {
            setImageUrls((current) => current.filter((_, currentIndex) => currentIndex !== index));
          }}
          onAddImages={(dataUrls) => {
            setImageUrls((current) => [...current, ...dataUrls]);
          }}
          isSending={isSending}
          onStop={onStop ?? (() => {})}
          onScreenshot={
            onStartScreenshot
              ? () => {
                  onStartScreenshot((dataUrl) => {
                    setImageUrls((current) => [...current, dataUrl]);
                  });
                }
              : undefined
          }
          onPreviewImage={onPreviewImage}
        />
      </div>
    </section>
  );
}
