import type { ChatMessage, ChatMessageContent } from '../../shared/types/chat';

const chatMessageTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Creates a chat message owned by the background global session.
 *
 * @param role - The message role.
 * @param content - The message content.
 * @param status - The message lifecycle status.
 * @returns A chat message with a generated id and display timestamp.
 */
export function createSessionChatMessage(
  role: ChatMessage['role'],
  content: ChatMessageContent,
  status: ChatMessage['status'] = 'completed',
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    status,
    createdAt: chatMessageTimeFormatter.format(new Date()),
  };
}
