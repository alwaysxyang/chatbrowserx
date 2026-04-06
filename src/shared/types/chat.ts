export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
  status?: 'completed' | 'error' | 'interrupted';
  // 对于 status === 'error' 的消息，保存更详细的错误原因，便于在 UI 右侧感叹号中展示
  errorMessage?: string;
}

export interface ChatRequestPayload {
  input: string;
  history: ChatMessage[];
}

export interface ChatResponsePayload {
  reply: string;
}
