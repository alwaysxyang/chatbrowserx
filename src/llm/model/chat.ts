import type { ToolDefinition } from '../tools/tool-registry';
import type { ChatContentPart } from '../../shared/types/chat';

/**
 * System message that provides instructions and context to the LLM.
 * System messages set the behavior and personality of the assistant.
 */
export interface LlmSystemMessage {
  role: 'system';
  content: string;
}

/**
 * User message containing input from the end user.
 * Content can be plain text or multimodal parts (text, images, etc.).
 */
export interface LlmUserMessage {
  role: 'user';
  content: string | ChatContentPart[];
}

/**
 * Tool call request from the LLM to execute a function.
 * Contains the function name and JSON-encoded arguments.
 */
export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Assistant message containing the LLM's response.
 * May include text content and/or tool calls for function execution.
 */
export interface LlmAssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: LlmToolCall[];
}

/**
 * Tool message containing the result of a tool call execution.
 * Sent back to the LLM after executing a requested function.
 */
export interface LlmToolMessage {
  role: 'tool';
  toolCallId: string;
  name: string;
  content: string;
}

/**
 * Union type representing any valid message in an LLM chat conversation.
 * Supports system instructions, user input, assistant responses, and tool results.
 */
export type LlmChatMessage = LlmSystemMessage | LlmUserMessage | LlmAssistantMessage | LlmToolMessage;

/**
 * Input parameters for a chat completion request.
 * Contains the conversation history, model identifier, and optional tool definitions.
 */
export interface ChatCompletionInput {
  messages: LlmChatMessage[];
  model: string;
  tools?: ToolDefinition[];
}

/**
 * Result of a chat completion request.
 * Contains the assistant's response message, which may include tool calls.
 */
export interface ChatCompletionResult {
  message: LlmAssistantMessage;
}

/**
 * Provider interface for chat completion functionality.
 * Implementations handle communication with specific LLM APIs (OpenAI, Anthropic, etc.).
 */
export interface ChatCompletionProvider {
  /**
   * Completes a chat conversation with the LLM.
   *
   * @param input - The chat completion request parameters
   * @param onChunk - Optional callback for streaming response chunks
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to the completion result
   */
  completeChat(
    input: ChatCompletionInput,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult>;
}
