import type { ChatRequestPayload, ChatResponsePayload } from './chat';
import type { RecognitionResult } from './speech';

/**
 * Message type identifier for chat requests sent to the background service.
 */
export const chatRequestType = 'chatbrowserx.chat.request';

/**
 * Message type identifier for streaming chat response chunks.
 */
export const chatStreamChunkType = 'chatbrowserx.chat.stream.chunk';

/**
 * Message type identifier for canceling an ongoing chat request.
 */
export const chatCancelType = 'chatbrowserx.chat.cancel';

/**
 * Port name used for establishing long-lived connections for chat sessions.
 */
export const chatSessionPortName = 'chatbrowserx.chat.session';

/**
 * Message type identifier for screenshot capture requests.
 */
export const screenshotCaptureRequestType = 'chatbrowserx.chat.screenshot.capture';

/**
 * Message type identifier for panel control commands.
 */
export const panelCommandType = 'chatbrowserx.panel.command';

/**
 * Message type identifier for page content extraction tool requests.
 */
export const getPageContentToolRequestType = 'chatbrowserx.tool.get-page-content.request';

/**
 * Message type identifier for starting speech recognition.
 */
export const speechStartRequestType = 'chatbrowserx.speech.start';

/**
 * Message type identifier for stopping speech recognition.
 */
export const speechStopRequestType = 'chatbrowserx.speech.stop';

/**
 * Message type identifier for speech recognition result updates.
 */
export const speechResultType = 'chatbrowserx.speech.result';

/**
 * Base interface for all runtime messages exchanged between extension components.
 * Uses a discriminated union pattern with the type field for type-safe message handling.
 *
 * @template TType - The specific message type string literal
 */
export interface RuntimeMessage<TType extends string = string> {
  type: TType;
}

/**
 * Represents a successful runtime operation response.
 *
 * @template TData - The type of data returned on success
 */
export interface RuntimeSuccessResponse<TData> {
  ok: true;
  data: TData;
}

/**
 * Represents a failed runtime operation response.
 */
export interface RuntimeErrorResponse {
  ok: false;
  error: string;
}

/**
 * Union type representing either a successful or failed runtime operation response.
 * Uses a discriminated union pattern with the ok field for type-safe error handling.
 *
 * @template TData - The type of data returned on success
 */
export type RuntimeResponse<TData> = RuntimeSuccessResponse<TData> | RuntimeErrorResponse;

/**
 * Message sent to initiate a chat request with the LLM provider.
 */
export interface ChatRequestMessage {
  type: typeof chatRequestType;
  payload: ChatRequestPayload;
}

/**
 * Represents a successful chat response.
 */
export interface ChatSuccessResponse {
  ok: true;
  data: ChatResponsePayload;
}

/**
 * Represents a failed chat response.
 */
export interface ChatErrorResponse {
  ok: false;
  error: string;
}

/**
 * Union type representing either a successful or failed chat operation response.
 */
export type ChatRuntimeResponse = ChatSuccessResponse | ChatErrorResponse;

/**
 * Message sent during streaming chat responses containing a chunk of content.
 */
export interface ChatStreamChunkMessage {
  type: typeof chatStreamChunkType;
  payload: {
    content: string;
  };
}

/**
 * Message sent to cancel an ongoing chat request.
 */
export interface ChatCancelMessage {
  type: typeof chatCancelType;
}

/**
 * Message sent to request a screenshot capture of the current page.
 */
export interface ScreenshotCaptureRequestMessage {
  type: typeof screenshotCaptureRequestType;
}

/**
 * Represents a successful screenshot capture response.
 */
export interface ScreenshotCaptureSuccessResponse {
  ok: true;
  data: {
    dataUrl: string;
  };
}

/**
 * Represents a failed screenshot capture response.
 */
export interface ScreenshotCaptureErrorResponse {
  ok: false;
  error: string;
}

/**
 * Union type representing either a successful or failed screenshot capture response.
 */
export type ScreenshotCaptureRuntimeResponse =
  | ScreenshotCaptureSuccessResponse
  | ScreenshotCaptureErrorResponse;

/**
 * Message sent to control panel behavior (toggle, open chat, open settings).
 */
export interface PanelCommandMessage {
  type: typeof panelCommandType;
  payload: {
    command: 'toggle-chat' | 'open-chat' | 'open-settings';
  };
}

/**
 * Message sent to request page content extraction for tool use.
 */
export interface GetPageContentToolRequestMessage {
  type: typeof getPageContentToolRequestType;
}

/**
 * Payload containing extracted page content information.
 */
export interface GetPageContentToolPayload {
  title: string;
  url: string;
  content: string;
}

/**
 * Message sent to start speech recognition.
 */
export interface SpeechStartRequestMessage {
  type: typeof speechStartRequestType;
  payload: {
    tabId: number;
  };
}

/**
 * Message sent to stop speech recognition.
 */
export interface SpeechStopRequestMessage {
  type: typeof speechStopRequestType;
}

/**
 * Message sent when speech recognition produces a result.
 */
export interface SpeechResultMessage {
  type: typeof speechResultType;
  payload: RecognitionResult;
}

/**
 * Represents a successful speech operation response.
 */
export interface SpeechSuccessResponse {
  ok: true;
  data: Record<string, never>;
}

/**
 * Represents a failed speech operation response.
 */
export interface SpeechErrorResponse {
  ok: false;
  error: string;
}

/**
 * Union type representing either a successful or failed speech operation response.
 */
export type SpeechRuntimeResponse = SpeechSuccessResponse | SpeechErrorResponse;

/**
 * Type guard that checks if an unknown value is a RuntimeMessage with a specific type.
 * Provides type-safe narrowing for runtime message validation.
 *
 * @template TType - The expected message type string literal
 * @param message - The value to check
 * @param type - The expected message type to match against
 * @returns True if the message is a RuntimeMessage with the specified type
 */
export function hasRuntimeMessageType<TType extends string>(message: unknown, type: TType): message is RuntimeMessage<TType> {
  return Boolean(message && typeof message === 'object' && 'type' in message && (message as RuntimeMessage<TType>).type === type);
}

/**
 * Creates a type guard function for a specific runtime message type.
 * This factory function enables reusable type guards for different message types.
 *
 * @template TMessage - The specific RuntimeMessage subtype to guard for
 * @param type - The message type identifier to check against
 * @returns A type guard function that checks if a value is the specified message type
 */
export function createRuntimeMessageGuard<TMessage extends RuntimeMessage<string>>(type: TMessage['type']) {
  return (message: unknown): message is TMessage => hasRuntimeMessageType(message, type);
}

/**
 * Extracts data from a RuntimeResponse or throws an error if the response failed.
 * Provides a convenient way to unwrap response data with automatic error handling.
 *
 * @template TData - The type of data contained in the response
 * @param response - The runtime response to extract data from
 * @param fallbackError - Error message to use if response is undefined or has no error message
 * @returns The extracted data from a successful response
 * @throws Error if the response is undefined, failed, or contains an error
 */
export function getRuntimeResponseData<TData>(response: RuntimeResponse<TData> | undefined, fallbackError: string): TData {
  if (!response?.ok) {
    throw new Error(response?.error || fallbackError);
  }

  return response.data;
}

/**
 * Wraps a promise in a RuntimeResponse, converting any thrown errors to error responses.
 * Provides consistent error handling for async operations in the extension.
 *
 * @template TData - The type of data the promise resolves to
 * @param task - The promise to wrap
 * @returns A promise that always resolves to a RuntimeResponse (never rejects)
 */
export async function toRuntimeResponse<TData>(task: Promise<TData>): Promise<RuntimeResponse<TData>> {
  try {
    return {
      ok: true,
      data: await task,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const isChatRequestMessageGuard = createRuntimeMessageGuard<ChatRequestMessage>(chatRequestType);
const isChatStreamChunkMessageGuard = createRuntimeMessageGuard<ChatStreamChunkMessage>(chatStreamChunkType);
const isChatCancelMessageGuard = createRuntimeMessageGuard<ChatCancelMessage>(chatCancelType);
const isScreenshotCaptureRequestMessageGuard = createRuntimeMessageGuard<ScreenshotCaptureRequestMessage>(
  screenshotCaptureRequestType,
);
const isPanelCommandMessageGuard = createRuntimeMessageGuard<PanelCommandMessage>(panelCommandType);
const isGetPageContentToolRequestMessageGuard = createRuntimeMessageGuard<GetPageContentToolRequestMessage>(
  getPageContentToolRequestType,
);
const isSpeechStartRequestMessageGuard = createRuntimeMessageGuard<SpeechStartRequestMessage>(speechStartRequestType);
const isSpeechStopRequestMessageGuard = createRuntimeMessageGuard<SpeechStopRequestMessage>(speechStopRequestType);
const isSpeechResultMessageGuard = createRuntimeMessageGuard<SpeechResultMessage>(speechResultType);


/**
 * Type guard that checks if an unknown value is a ChatRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatRequestMessage
 */
export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return isChatRequestMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a ChatStreamChunkMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatStreamChunkMessage
 */
export function isChatStreamChunkMessage(message: unknown): message is ChatStreamChunkMessage {
  return isChatStreamChunkMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a ChatCancelMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ChatCancelMessage
 */
export function isChatCancelMessage(message: unknown): message is ChatCancelMessage {
  return isChatCancelMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a ScreenshotCaptureRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a ScreenshotCaptureRequestMessage
 */
export function isScreenshotCaptureRequestMessage(message: unknown): message is ScreenshotCaptureRequestMessage {
  return isScreenshotCaptureRequestMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a PanelCommandMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a PanelCommandMessage
 */
export function isPanelCommandMessage(message: unknown): message is PanelCommandMessage {
  return isPanelCommandMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a GetPageContentToolRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a GetPageContentToolRequestMessage
 */
export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return isGetPageContentToolRequestMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a SpeechStartRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a SpeechStartRequestMessage
 */
export function isSpeechStartRequestMessage(message: unknown): message is SpeechStartRequestMessage {
  return isSpeechStartRequestMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a SpeechStopRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a SpeechStopRequestMessage
 */
export function isSpeechStopRequestMessage(message: unknown): message is SpeechStopRequestMessage {
  return isSpeechStopRequestMessageGuard(message);
}

/**
 * Type guard that checks if an unknown value is a SpeechResultMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a SpeechResultMessage
 */
export function isSpeechResultMessage(message: unknown): message is SpeechResultMessage {
  return isSpeechResultMessageGuard(message);
}
