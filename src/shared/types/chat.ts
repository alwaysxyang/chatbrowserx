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
 * Payload for initiating a chat request to the LLM provider.
 * Contains the user's input and conversation history for context.
 */
export interface ChatRequestPayload {
  /** The user's current input message */
  input: ChatMessageContent;
  /** Previous messages in the conversation for context */
  history: ChatMessage[];
}

/**
 * Payload for chat responses from the LLM provider.
 * Contains the assistant's reply text.
 */
export interface ChatResponsePayload {
  /** The assistant's response text */
  reply: string;
}
