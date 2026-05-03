import type { RuntimeMessage, RuntimeResponse } from './runtime-messages';
import { createRuntimeMessageGuard } from './runtime-messages';

/**
 * Supported selection actions initiated from the content script.
 */
export type SelectionMode = 'translate' | 'ask_ai';

/**
 * Payload for initiating a selection-based request.
 */
export interface SelectionRequestPayload {
  /** Client-generated id to correlate streaming chunks to the active UI request. */
  requestId: string;
  /** The selection operation to perform. */
  mode: SelectionMode;
  /** Fully constructed user prompt sent to the model. */
  prompt: string;
}

/**
 * Payload for selection responses from the background service.
 */
export interface SelectionResponsePayload {
  /** The final response text. */
  reply: string;
}

/**
 * Message type identifier for selection requests sent to the background service.
 */
export const selectionRequestType = 'chatbrowserx.selection.request';

/**
 * Message type identifier for streaming selection response chunks.
 */
export const selectionStreamChunkType = 'chatbrowserx.selection.stream.chunk';

/**
 * Message type identifier for canceling an ongoing selection request.
 */
export const selectionCancelType = 'chatbrowserx.selection.cancel';

/**
 * Message sent to initiate a selection request with the LLM provider.
 */
export interface SelectionRequestMessage extends RuntimeMessage<typeof selectionRequestType> {
  payload: SelectionRequestPayload;
}

/**
 * Runtime response envelope for selection operations.
 */
export type SelectionRuntimeResponse = RuntimeResponse<SelectionResponsePayload>;

/**
 * Message sent during streaming selection responses containing a chunk of content.
 */
export interface SelectionStreamChunkMessage extends RuntimeMessage<typeof selectionStreamChunkType> {
  payload: {
    requestId: string;
    content: string;
  };
}

/**
 * Message sent to cancel an ongoing selection request.
 */
export interface SelectionCancelMessage extends RuntimeMessage<typeof selectionCancelType> {}

/**
 * Checks whether a value is a supported selection mode.
 */
function isSelectionMode(value: unknown): value is SelectionMode {
  return value === 'translate' || value === 'ask_ai';
}

const isSelectionRequestMessageGuard = createRuntimeMessageGuard<SelectionRequestMessage>(selectionRequestType);
const isSelectionStreamChunkMessageGuard = createRuntimeMessageGuard<SelectionStreamChunkMessage>(selectionStreamChunkType);
const isSelectionCancelMessageGuard = createRuntimeMessageGuard<SelectionCancelMessage>(selectionCancelType);

/**
 * Type guard that checks if an unknown value is a SelectionRequestMessage.
 *
 * @param message - The value to check.
 * @returns True if the message is a SelectionRequestMessage.
 */
export function isSelectionRequestMessage(message: unknown): message is SelectionRequestMessage {
  if (!isSelectionRequestMessageGuard(message)) return false;
  const payload = message.payload;

  return Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof (payload as SelectionRequestPayload).requestId === 'string' &&
      isSelectionMode((payload as SelectionRequestPayload).mode) &&
      typeof (payload as SelectionRequestPayload).prompt === 'string',
  );
}

/**
 * Type guard that checks if an unknown value is a SelectionStreamChunkMessage.
 *
 * @param message - The value to check.
 * @returns True if the message is a SelectionStreamChunkMessage.
 */
export function isSelectionStreamChunkMessage(message: unknown): message is SelectionStreamChunkMessage {
  if (!isSelectionStreamChunkMessageGuard(message)) return false;
  return Boolean(
    message.payload &&
      typeof message.payload === 'object' &&
      typeof (message.payload as SelectionStreamChunkMessage['payload']).requestId === 'string' &&
      typeof (message.payload as SelectionStreamChunkMessage['payload']).content === 'string',
  );
}

/**
 * Type guard that checks if an unknown value is a SelectionCancelMessage.
 *
 * @param message - The value to check.
 * @returns True if the message is a SelectionCancelMessage.
 */
export function isSelectionCancelMessage(message: unknown): message is SelectionCancelMessage {
  return isSelectionCancelMessageGuard(message);
}
