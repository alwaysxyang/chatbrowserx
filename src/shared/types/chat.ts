import type { RuntimeMessage, RuntimeResponse } from './runtime-messages';
import { hasRuntimeMessageType } from './runtime-messages';

/**
 * Role identifier for chat participants.
 * - 'user': Messages from the end user
 * - 'assistant': Messages from the AI assistant
 */
export type ChatRole = 'user' | 'assistant';

/**
 * Represents a text content part in a chat message.
 * Used for plain text content in multi-part messages.
 */
export interface ChatTextContentPart {
  type: 'text';
  text: string;
}

/**
 * Represents an image content part in a chat message.
 * Used for including images in multi-part messages via URL.
 */
export interface ChatImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

/**
 * Union type representing any valid content part in a chat message.
 * Supports both text and image content types.
 */
export type ChatContentPart = ChatTextContentPart | ChatImageContentPart;

/**
 * Flexible content type for chat messages.
 * Can be either a simple string or an array of structured content parts
 * (text and/or images) for multi-modal messages.
 */
export type ChatMessageContent = string | ChatContentPart[];

/**
 * Normalizes chat message content into an array of content parts.
 * Converts string content into a single text content part.
 *
 * @param content - The chat message content to normalize
 * @returns Array of content parts
 */
export function getChatMessageContentParts(content: ChatMessageContent): ChatContentPart[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content;
}

/**
 * Extracts all text content from a chat message, filtering out non-text parts.
 * Multiple text parts are joined with newlines.
 *
 * @param content - The chat message content to extract text from
 * @returns Concatenated text content
 */
export function getChatMessageTextContent(content: ChatMessageContent): string {
  return getChatMessageContentParts(content)
    .filter((part): part is ChatTextContentPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

/**
 * Represents a single message in a chat conversation.
 * Supports multi-modal content and tracks message lifecycle status.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender (user or assistant) */
  role: ChatRole;
  /** Message content (text, images, or mixed) */
  content: ChatMessageContent;
  /** ISO 8601 timestamp of message creation */
  createdAt?: string;
  /**
   * Current status of the message:
   * - 'completed': Message generation finished successfully
   * - 'streaming': Message is being generated in real-time
   * - 'error': Message generation failed
   * - 'interrupted': Message generation was manually stopped
   */
  status?: 'completed' | 'streaming' | 'error' | 'interrupted';
  /** Detailed error description for messages with status 'error', displayed in UI */
  errorMessage?: string;
}

/**
 * Runtime payload for initiating a background-owned chat request.
 * The global coordinator owns conversation history and appends it internally.
 */
export interface ChatRequestPayload {
  /** The user's current input message */
  input: ChatMessageContent;
}

/**
 * Payload for chat responses from the LLM provider.
 * Contains the assistant's reply text.
 */
export interface ChatResponsePayload {
  /** The assistant's response text */
  reply: string;
}

/**
 * Payload for screenshot capture responses.
 */
export interface ScreenshotCaptureResponsePayload {
  dataUrl: string;
}

// ============================================================================
// Runtime Messages
// ============================================================================

/**
 * Message type identifier for chat requests sent to the background service.
 */
export const chatRequestType = 'chatbrowserx.chat.request';

/**
 * Message type identifier for streaming chat response chunks.
 */
export const chatStreamChunkType = 'chatbrowserx.chat.stream.chunk';

/**
 * Message type identifier for querying the global chat session state.
 */
export const chatStateQueryType = 'chatbrowserx.chat.state.query';

/**
 * Message type identifier for broadcasting the global chat session state.
 */
export const chatStateSyncType = 'chatbrowserx.chat.state.sync';

/**
 * Message type identifier for canceling an ongoing chat request.
 */
export const chatCancelType = 'chatbrowserx.chat.cancel';

/**
 * Message type identifier for clearing the global chat session.
 */
export const chatClearType = 'chatbrowserx.chat.clear';

/**
 * Port name used for establishing long-lived connections for chat sessions.
 */
export const chatSessionPortName = 'chatbrowserx.chat.session';

/**
 * Message type identifier for screenshot capture requests.
 */
export const screenshotCaptureRequestType = 'chatbrowserx.chat.screenshot.capture';

/**
 * Message sent to initiate a background chat request.
 */
export interface ChatRequestMessage extends RuntimeMessage<typeof chatRequestType> {
  payload: ChatRequestPayload;
}

/**
 * Runtime response envelope for chat operations.
 */
export type ChatRuntimeResponse = RuntimeResponse<ChatResponsePayload>;

/**
 * Snapshot of the authoritative global chat session state.
 */
export interface ChatSessionState {
  messages: ChatMessage[];
  isRunning: boolean;
  requestId: number | null;
  activeAssistantMessageId: string | null;
}

/**
 * Message sent to query the current global chat session state.
 */
export interface ChatStateQueryMessage extends RuntimeMessage<typeof chatStateQueryType> {}

/**
 * Message sent to synchronize global chat session state to content UIs.
 */
export interface ChatStateSyncMessage extends RuntimeMessage<typeof chatStateSyncType> {
  payload: ChatSessionState;
}

/**
 * Runtime response envelope for global chat state queries.
 */
export type ChatStateRuntimeResponse = RuntimeResponse<ChatSessionState>;

/**
 * Message sent during streaming chat responses containing a chunk of content.
 */
export interface ChatStreamChunkMessage extends RuntimeMessage<typeof chatStreamChunkType> {
  payload: {
    requestId: number;
    messageId: string;
    content: string;
  };
}

/**
 * Message sent to cancel an ongoing chat request.
 */
export interface ChatCancelMessage extends RuntimeMessage<typeof chatCancelType> {}

/**
 * Message sent to clear the global chat session.
 */
export interface ChatClearMessage extends RuntimeMessage<typeof chatClearType> {}

/**
 * Message sent to request a screenshot capture of the current page.
 */
export interface ScreenshotCaptureRequestMessage extends RuntimeMessage<typeof screenshotCaptureRequestType> {}

/**
 * Union type representing either a successful or failed screenshot capture response.
 */
export type ScreenshotCaptureRuntimeResponse = RuntimeResponse<ScreenshotCaptureResponsePayload>;

/**
 * Type guard that checks if an unknown value is a ChatRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatRequestMessage
 */
export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return hasRuntimeMessageType(message, chatRequestType);
}

/**
 * Type guard that checks if an unknown value is a ChatStreamChunkMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatStreamChunkMessage
 */
export function isChatStreamChunkMessage(message: unknown): message is ChatStreamChunkMessage {
  return hasRuntimeMessageType(message, chatStreamChunkType);
}

/**
 * Type guard that checks if an unknown value is a ChatStateQueryMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatStateQueryMessage
 */
export function isChatStateQueryMessage(message: unknown): message is ChatStateQueryMessage {
  return hasRuntimeMessageType(message, chatStateQueryType);
}

/**
 * Type guard that checks if an unknown value is a ChatStateSyncMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatStateSyncMessage
 */
export function isChatStateSyncMessage(message: unknown): message is ChatStateSyncMessage {
  return hasRuntimeMessageType(message, chatStateSyncType);
}

/**
 * Type guard that checks if an unknown value is a ChatCancelMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatCancelMessage
 */
export function isChatCancelMessage(message: unknown): message is ChatCancelMessage {
  return hasRuntimeMessageType(message, chatCancelType);
}

/**
 * Type guard that checks if an unknown value is a ChatClearMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatClearMessage
 */
export function isChatClearMessage(message: unknown): message is ChatClearMessage {
  return hasRuntimeMessageType(message, chatClearType);
}

/**
 * Type guard that checks if an unknown value is a ScreenshotCaptureRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ScreenshotCaptureRequestMessage
 */
export function isScreenshotCaptureRequestMessage(message: unknown): message is ScreenshotCaptureRequestMessage {
  return hasRuntimeMessageType(message, screenshotCaptureRequestType);
}
