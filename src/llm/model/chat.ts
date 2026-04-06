import type { ToolDefinition } from '../tools/tool-registry';
import type { ChatContentPart } from '../../shared/types/chat';

export interface LlmSystemMessage {
  role: 'system';
  content: string;
}

export interface LlmUserMessage {
  role: 'user';
  content: string | ChatContentPart[];
}

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmAssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmToolMessage {
  role: 'tool';
  toolCallId: string;
  name: string;
  content: string;
}

export type LlmChatMessage = LlmSystemMessage | LlmUserMessage | LlmAssistantMessage | LlmToolMessage;

export interface ChatCompletionInput {
  messages: LlmChatMessage[];
  model: string;
  tools?: ToolDefinition[];
}

export interface ChatCompletionResult {
  message: LlmAssistantMessage;
}

export interface ChatCompletionProvider {
  completeChat(
    input: ChatCompletionInput,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult>;
}
