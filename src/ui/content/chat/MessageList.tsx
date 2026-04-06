import { useEffect, useRef } from 'react';
import { Bot, CircleAlert, LoaderCircle, UserRound } from 'lucide-react';
import type { ChatMessage } from '../../../shared/types/chat';
import { translateMessage } from '../../../shared/i18n/i18n';

interface MessageListProps {
  messages: ChatMessage[];
  errorMessage: string | null;
  isSending: boolean;
  streamingContent?: string;
}

export function MessageList({ messages, errorMessage, isSending, streamingContent }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [errorMessage, isSending, messages, streamingContent]);

  if (!messages.length && !isSending && !errorMessage) {
    return null;
  }

  return (
    <div ref={listRef} className="message-list" data-testid="message-list">
      {messages.map((message) => {
        const isUser = message.role === 'user';
        const isAssistant = message.role === 'assistant';
        const isError = isAssistant && message.status === 'error';

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
        const hasErrorDetail = isError && !!message.errorMessage && !!message.content.trim();
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
                <div>{message.content}</div>
              </article>
              {message.createdAt ? <div className={`message-time message-time-${message.role}`}>{message.createdAt}</div> : null}
            </div>

            {isUser ? (
              <div className={avatarClassName} aria-hidden="true" data-testid={avatarTestId}>
                <UserRound className="h-4 w-4" strokeWidth={2.2} />
              </div>
            ) : null}

            {showRightIndicator ? (
              <div className="message-interrupted-indicator" data-tooltip={message.errorMessage || ''}>
                <CircleAlert className="h-3 w-3 text-red-500" strokeWidth={2.2} />
              </div>
            ) : null}
          </div>
        );
      })}
      {errorMessage ? null : null}
      {isSending ? (
        <div className="message-row message-row-assistant">
          <div className="message-avatar message-avatar-loading" aria-hidden="true" data-testid="assistant-avatar-loading">
            <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          </div>
          <div className="message-stack message-stack-assistant">
            <div className="message-card message-card-assistant">
              {streamingContent && streamingContent.length > 0
                ? streamingContent
                : translateMessage('chat.loading')}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
