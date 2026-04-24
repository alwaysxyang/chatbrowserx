import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../shared/types/chat';
import { MessageListItem } from './MessageListItem';

interface MessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
  onPreviewImage?: (src: string) => void;
}

export function MessageList({ messages, isSending, onPreviewImage }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
    listRef.current.scrollLeft = 0;
  }, [isSending, messages]);

  if (!messages.length && !isSending) {
    return null;
  }

  return (
    <div ref={listRef} className="message-list" data-testid="message-list">
      {messages.map((message) => (
        <MessageListItem
          key={message.id}
          isSending={isSending}
          message={message}
          onPreviewImage={onPreviewImage}
        />
      ))}
    </div>
  );
}
