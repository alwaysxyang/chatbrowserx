import { getChatMessageTextContent, type ChatMessage, type ChatMessageContent } from '../../../shared/types/chat';

const chatMessageTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function createChatMessage(
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

export function buildChatRequestHistory(source: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const message of source) {
    const isAssistantError = message.role === 'assistant' && message.status === 'error';

    if (!isAssistantError) {
      result.push({
        ...message,
        content: getChatMessageTextContent(message.content),
      });
      continue;
    }

    for (let index = result.length - 1; index >= 0; index -= 1) {
      const candidate = result[index];

      if (candidate.role === 'assistant') {
        break;
      }

      if (candidate.role === 'user') {
        result.splice(index, 1);
        break;
      }
    }
  }

  return result;
}

export function buildChatErrorMessage(message: ChatMessage, errorMessage: string): ChatMessage {
  const result: ChatMessage = {
    ...message,
    status: 'error',
    errorMessage,
  };

  if (typeof result.content === 'string') {
    if (!result.content) {
      result.content = errorMessage;
    }
  } else if (Array.isArray(result.content) && result.content.length === 0) {
    result.content = errorMessage;
  }

  return result;
}

export function updateChatMessageById(
  messages: ChatMessage[],
  id: string | null,
  mapFn: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  if (!id) {
    return messages;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].id === id) {
      const nextMessages = [...messages];
      nextMessages[index] = mapFn(nextMessages[index]);
      return nextMessages;
    }
  }

  return messages;
}
