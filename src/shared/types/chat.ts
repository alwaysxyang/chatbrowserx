export type ChatRole = 'user' | 'assistant';

export interface ChatTextContentPart {
  type: 'text';
  text: string;
}

export interface ChatImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type ChatContentPart = ChatTextContentPart | ChatImageContentPart;

export type ChatMessageContent = string | ChatContentPart[];

export function getChatMessageContentParts(content: ChatMessageContent): ChatContentPart[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content;
}

export function getChatMessageTextContent(content: ChatMessageContent): string {
  return getChatMessageContentParts(content)
    .filter((part): part is ChatTextContentPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: ChatMessageContent;
  createdAt?: string;
  status?: 'completed' | 'error' | 'interrupted';
  // 对于 status === 'error' 的消息，保存更详细的错误原因，便于在 UI 右侧感叹号中展示
  errorMessage?: string;
}

export interface ChatRequestPayload {
  input: ChatMessageContent;
  history: ChatMessage[];
}

export interface ChatResponsePayload {
  reply: string;
}
