import type { RuntimeMessage, RuntimeResponse } from './runtime-messages';
import { createRuntimeMessageGuard } from './runtime-messages';

/**
 * Recognition result from speech recognition service.
 */
export interface RecognitionResult {
  sourceText: string;
  translationText?: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

/**
 * Response payload for speech state query.
 */
export interface SpeechStateQueryResponsePayload {
  isRecording: boolean;
}

// ============================================================================
// Runtime Messages
// ============================================================================

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
 * Message type identifier for querying speech state.
 */
export const speechStateQueryType = 'chatbrowserx.speech.state.query';

/**
 * Message sent to start speech recognition.
 */
export interface SpeechStartRequestMessage extends RuntimeMessage<typeof speechStartRequestType> {}

/**
 * Message sent to stop speech recognition.
 */
export interface SpeechStopRequestMessage extends RuntimeMessage<typeof speechStopRequestType> {}

/**
 * Message sent when speech recognition produces a result.
 */
export interface SpeechResultMessage extends RuntimeMessage<typeof speechResultType> {
  payload: RecognitionResult;
}

/**
 * Message sent to query current speech state.
 */
export interface SpeechStateQueryMessage extends RuntimeMessage<typeof speechStateQueryType> {}

/**
 * Represents a successful speech operation response.
 */
export type SpeechRuntimeResponse = RuntimeResponse<null>;

/**
 * Represents a successful speech state query response.
 */
export type SpeechStateQueryResponse = RuntimeResponse<SpeechStateQueryResponsePayload>;

const isSpeechStartRequestMessageGuard = createRuntimeMessageGuard<SpeechStartRequestMessage>(speechStartRequestType);
const isSpeechStopRequestMessageGuard = createRuntimeMessageGuard<SpeechStopRequestMessage>(speechStopRequestType);
const isSpeechResultMessageGuard = createRuntimeMessageGuard<SpeechResultMessage>(speechResultType);
const isSpeechStateQueryMessageGuard = createRuntimeMessageGuard<SpeechStateQueryMessage>(speechStateQueryType);

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

/**
 * Type guard that checks if an unknown value is a SpeechStateQueryMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a SpeechStateQueryMessage
 */
export function isSpeechStateQueryMessage(message: unknown): message is SpeechStateQueryMessage {
  return isSpeechStateQueryMessageGuard(message);
}
