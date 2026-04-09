import { useEffect, useRef, useState } from 'react';
import { Bot, Check, CircleAlert, Copy, LoaderCircle, UserRound } from 'lucide-react';
import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx';
import { getChatMessageContentParts, getChatMessageTextContent, type ChatMessage } from '../../../shared/types/chat';
import { translateMessage } from '../../../shared/i18n/i18n';

const markdownOptions: MarkdownToJSX.Options = {
  overrides: {
    a: {
      component: ({ children, ...props }: any) => (
        // 统一在气泡内的链接样式与行为
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="message-markdown-link"
        >
          {children}
        </a>
      ),
    },
    code: {
      component: ({ children, className, ...props }: any) => {
        const isBlock = typeof className === 'string' && className.includes('lang-');

        return (
          <code
            {...props}
            className={`message-markdown-code ${isBlock ? 'message-markdown-code-block' : 'message-markdown-code-inline'} ${
              className ?? ''
            }`}
          >
            {children}
          </code>
        );
      },
    },
    pre: {
      component: ({ children, ...props }: any) => (
        <pre {...props} className="message-markdown-pre">
          {children}
        </pre>
      ),
    },
  },
};

interface MessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
  onPreviewImage?: (src: string) => void;
}

export function MessageList({ messages, isSending, onPreviewImage }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isSending, messages]);

  if (!messages.length && !isSending) {
    return null;
  }

  return (
    <div ref={listRef} className="message-list" data-testid="message-list">
      {messages.map((message) => {
        const isUser = message.role === 'user';
        const isAssistant = message.role === 'assistant';
        const isError = isAssistant && message.status === 'error';
        const isStreamingAssistant = isAssistant && message.status === 'streaming' && isSending;
        const textContent = getChatMessageTextContent(message.content);
        const imageParts = isUser
          ? getChatMessageContentParts(message.content).filter((part) => part.type === 'image_url')
          : [];
        const hasCopyableText = !!textContent;

        const avatarClassName = isUser
          ? 'message-avatar message-avatar-user'
          : isError
          ? 'message-avatar message-avatar-error'
          : isStreamingAssistant
          ? 'message-avatar message-avatar-loading'
          : 'message-avatar message-avatar-assistant';

        const avatarTestId = isUser
          ? 'user-avatar'
          : isError
          ? 'assistant-avatar-error'
          : isStreamingAssistant
          ? 'assistant-avatar-loading'
          : 'assistant-avatar-completed';

        const cardClassName = isError
          ? 'message-card message-card-assistant message-card-error'
          : `message-card message-card-${message.role}`;

        // 右侧小红叹号：仅在“错误且已有 SSE 文本”时展示，tooltip 使用 errorMessage
        const hasErrorDetail = isError && !!message.errorMessage && !!textContent.trim();
        const showRightIndicator = isAssistant && hasErrorDetail;

        return (
          <div key={message.id} className={`message-row message-row-${message.role}`}>
            {!isUser ? (
              <div
                className={avatarClassName}
                aria-hidden="true"
                data-testid={avatarTestId}
              >
                {isError ? (
                  <CircleAlert className="h-4 w-4" strokeWidth={2.2} />
                ) : isStreamingAssistant ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                ) : (
                  <Bot className="h-4 w-4" strokeWidth={2.2} />
                )}
              </div>
            ) : null}

            <div
              className={`message-stack message-stack-${message.role}`}
              onMouseLeave={() => {
                setCopiedMessageId((current) => (current === message.id ? null : current));
              }}
            >
              <article className={cardClassName}>
                <div className="message-content">
                  {imageParts.map((part, index) => (
                    <img
                      key={`${message.id}-image-${index}`}
                      className="message-content-image"
                      src={part.image_url.url}
                      alt={translateMessage('chat.message.imageAlt')}
                      onDoubleClick={() => {
                        onPreviewImage?.(part.image_url.url);
                      }}
                    />
                  ))}
                  {textContent ? (
                    <Markdown options={markdownOptions}>{textContent}</Markdown>
                  ) : isStreamingAssistant ? (
                    <Markdown options={markdownOptions}>{translateMessage('chat.loading')}</Markdown>
                  ) : null}
                </div>
              </article>
              {message.createdAt || hasCopyableText ? (
                <div className={`message-meta message-meta-${message.role}`}>
                  {message.createdAt ? (
                    <div className={`message-time message-time-${message.role}`}>{message.createdAt}</div>
                  ) : null}
                  {hasCopyableText ? (
                    <button
                      type="button"
                      className="message-copy-button"
                      aria-label={
                        copiedMessageId === message.id
                          ? translateMessage('chat.message.copied')
                          : translateMessage('chat.message.copy')
                      }
                      data-tooltip={
                        copiedMessageId === message.id
                          ? translateMessage('chat.message.copied')
                          : translateMessage('chat.message.copy')
                      }
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(textContent);
                          setCopiedMessageId(message.id);
                        } catch {
                          // ignore clipboard errors in unsupported environments
                        }
                      }}
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="h-3 w-3 message-copy-icon-success" strokeWidth={2.2} />
                      ) : (
                        <Copy className="h-3 w-3" strokeWidth={2.0} />
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isUser ? (
              <div className={avatarClassName} aria-hidden="true" data-testid={avatarTestId}>
                <UserRound className="h-4 w-4" strokeWidth={2.2} />
              </div>
            ) : null}

            {showRightIndicator ? (
              <div
                className="message-interrupted-indicator-wrapper"
                onMouseEnter={() => {
                  setActiveErrorId(message.id);
                }}
              >
                <div className="message-interrupted-indicator">
                  <CircleAlert className="h-3 w-3 text-red-500" strokeWidth={2.2} />
                </div>
                {activeErrorId === message.id ? (
                  <div
                    className="message-error-tooltip"
                    onMouseLeave={() => {
                      setActiveErrorId((current) => (current === message.id ? null : current));
                    }}
                  >
                    {message.errorMessage}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
