import { useState } from 'react';
import { Bot, Check, CircleAlert, Copy, LoaderCircle, UserRound } from 'lucide-react';
import { getChatMessageContentParts, getChatMessageTextContent, type ChatMessage } from '../../../shared/types/chat';
import { translateMessage } from '../../../shared/i18n/i18n';
import { MessageMarkdown } from '../../shared/MessageMarkdown';
import { copyMessageContent } from './copy-message-content';

interface MessageListItemProps {
  message: ChatMessage;
  isSending: boolean;
  onPreviewImage?: (src: string) => void;
}

export function MessageListItem({ message, isSending, onPreviewImage }: MessageListItemProps) {
  const [isErrorTooltipOpen, setIsErrorTooltipOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
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
  const hasErrorDetail = isError && !!message.errorMessage && !!textContent.trim();
  const showRightIndicator = isAssistant && hasErrorDetail;

  return (
    <div className={`message-row message-row-${message.role}`}>
      {!isUser ? (
        <div className={avatarClassName} aria-hidden="true" data-testid={avatarTestId}>
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
          setIsCopied(false);
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
              <MessageMarkdown content={textContent} />
            ) : isStreamingAssistant ? (
              <MessageMarkdown content={translateMessage('chat.loading')} />
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
                aria-label={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
                data-tooltip={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
                onClick={async () => {
                  try {
                    await copyMessageContent(message.content);
                    setIsCopied(true);
                  } catch {
                    // ignore clipboard errors in unsupported environments
                  }
                }}
              >
                {isCopied ? (
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
            setIsErrorTooltipOpen(true);
          }}
        >
          <div className="message-interrupted-indicator">
            <CircleAlert className="h-3 w-3 text-red-500" strokeWidth={2.2} />
          </div>
          {isErrorTooltipOpen ? (
            <div
              className="message-error-tooltip"
              onMouseLeave={() => {
                setIsErrorTooltipOpen(false);
              }}
            >
              {message.errorMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
