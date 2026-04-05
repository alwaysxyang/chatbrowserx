export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
  status?: 'completed' | 'error';
}

export interface ChatRequestPayload {
  input: string;
  history: ChatMessage[];
}

export interface ChatResponsePayload {
  reply: string;
}
