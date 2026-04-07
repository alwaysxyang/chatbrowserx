import { useEffect, useRef, useState } from 'react';
import { Bot, CircleAlert, LoaderCircle, UserRound } from 'lucide-react';
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
  streamingContent?: string;
}

export function MessageList({ messages, isSending, streamingContent }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isSending, messages, streamingContent]);

  if (!messages.length && !isSending) {
    return null;
  }

  return (
    <div ref={listRef} className="message-list" data-testid="message-list">
      {messages.map((message) => {
        const isUser = message.role === 'user';
        const isAssistant = message.role === 'assistant';
        const isError = isAssistant && message.status === 'error';
        const textContent = getChatMessageTextContent(message.content);
        const contentParts = getChatMessageContentParts(message.content);
        const imageParts = contentParts.filter((part) => part.type === 'image_url');

        const avatarClassName = isUser
          ? 'message-avatar message-avatar-user'
          : isError
          ? 'message-avatar message-avatar-error'
          : 'message-avatar message-avatar-assistant';

        const avatarTestId = isUser
          ? 'user-avatar'
          : isError
          ? 'assistant-avatar-error'
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
              <div className={avatarClassName} aria-hidden="true" data-testid={avatarTestId}>
                {isError ? (
                  <CircleAlert className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Bot className="h-4 w-4" strokeWidth={2.2} />
                )}
              </div>
            ) : null}

            <div className={`message-stack message-stack-${message.role}`}>
              <article className={cardClassName}>
                <div className="message-content">
                  {imageParts.map((part, index) => (
                    <img
                      key={`${message.id}-image-${index}`}
                      className="message-content-image"
                      src={part.image_url.url}
                      alt={translateMessage('chat.message.imageAlt')}
                    />
                  ))}
                  {textContent ? <Markdown options={markdownOptions}>{textContent}</Markdown> : null}
                </div>
              </article>
              {message.createdAt ? <div className={`message-time message-time-${message.role}`}>{message.createdAt}</div> : null}
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
      {isSending ? (
        <div className="message-row message-row-assistant">
          <div className="message-avatar message-avatar-loading" aria-hidden="true" data-testid="assistant-avatar-loading">
            <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          </div>
          <div className="message-stack message-stack-assistant">
            <div className="message-card message-card-assistant">
              {streamingContent && streamingContent.length > 0 ? (
                <Markdown options={markdownOptions}>{streamingContent}</Markdown>
              ) : (
                translateMessage('chat.loading')
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
