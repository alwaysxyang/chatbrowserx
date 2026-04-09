import { useState } from 'react';
import type { ChatContentPart, ChatMessage, ChatMessageContent } from '../../../shared/types/chat';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatPanelProps {
  messages: ChatMessage[];
  isSending: boolean;
  onSendMessage: (input: ChatMessageContent) => Promise<string>;
  onClearHistory: () => void;
  onStop?: () => void;
  onStartScreenshot?: (onCaptured: (dataUrl: string) => void) => void;
  onPreviewImage?: (src: string) => void;
}

function buildComposerContent(text: string, screenshotUrls: string[]): ChatMessageContent {
  if (!screenshotUrls.length) {
    return text;
  }

  const parts: ChatContentPart[] = screenshotUrls.map((url) => ({
    type: 'image_url',
    image_url: { url },
  }));

  if (text) {
    parts.push({ type: 'text', text });
  }

  return parts;
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
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const hasHistory = messages.length > 0;

  const submitMessage = async (input: string, screenshots: string[] = []) => {
    const trimmed = input.trim();
    if ((!trimmed && !screenshots.length) || isSending) {
      return;
    }

    try {
      setDraft('');
      setScreenshotUrls([]);
      await onSendMessage(buildComposerContent(trimmed, screenshots));
    } catch {}
  };

  const handleSubmit = async () => {
    await submitMessage(draft, screenshotUrls);
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
          screenshotUrls={screenshotUrls}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onClear={() => {
            setDraft('');
            setScreenshotUrls([]);
            onClearHistory();
          }}
          onRemoveScreenshot={(index) => {
            setScreenshotUrls((current) => current.filter((_, currentIndex) => currentIndex !== index));
          }}
          onAddScreenshots={(dataUrls) => {
            setScreenshotUrls((current) => [...current, ...dataUrls]);
          }}
          isSending={isSending}
          onStop={onStop ?? (() => {})}
          onScreenshot={
            onStartScreenshot
              ? () => {
                  onStartScreenshot((dataUrl) => {
                    setScreenshotUrls((current) => [...current, dataUrl]);
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
