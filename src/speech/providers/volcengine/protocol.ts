/**
 * Volcengine WebSocket protocol types for real-time speech recognition and translation.
 * Based on: https://www.volcengine.com/docs/6561/80818
 */

/**
 * Message types sent from client to server
 */
export enum ClientMessageType {
  /** Client ready to start audio streaming */
  ClientReady = 'ClientReady',
  /** Audio data chunk */
  AudioOnlyRequest = 'AudioOnlyRequest',
  /** Client finished sending audio */
  ClientFinish = 'ClientFinish',
}

/**
 * Message types sent from server to client
 */
export enum ServerMessageType {
  /** Server ready to receive audio */
  ServerReady = 'ServerReady',
  /** Source language subtitle started */
  SourceSubtitleStart = 'SourceSubtitleStart',
  /** Source language subtitle content */
  SourceSubtitleResponse = 'SourceSubtitleResponse',
  /** Source language subtitle ended */
  SourceSubtitleEnd = 'SourceSubtitleEnd',
  /** Translation subtitle started */
  TranslationSubtitleStart = 'TranslationSubtitleStart',
  /** Translation subtitle content */
  TranslationSubtitleResponse = 'TranslationSubtitleResponse',
  /** Translation subtitle ended */
  TranslationSubtitleEnd = 'TranslationSubtitleEnd',
  /** Server error */
  ServerError = 'ServerError',
}

/**
 * Client ready message payload
 */
export interface ClientReadyPayload {
  protocol_version: string;
  task: string;
  user: {
    uid: string;
  };
  audio: {
    format: string;
    sample_rate: number;
    channel: number;
    bits: number;
  };
  request: {
    reqid: string;
    sequence: number;
    nbest: number;
    result_type: string;
    source_language: string;
    target_language: string;
  };
}

/**
 * Audio data message payload
 */
export interface AudioOnlyRequestPayload {
  sequence: number;
  data: ArrayBuffer;
}

/**
 * Client finish message payload
 */
export interface ClientFinishPayload {
  sequence: number;
}

/**
 * Server ready message payload
 */
export interface ServerReadyPayload {
  code: number;
  message: string;
  reqid: string;
}

/**
 * Subtitle message payload (both source and translation)
 */
export interface SubtitlePayload {
  utterance_id: string;
  text: string;
  start_time: number;
  end_time: number;
  words?: Array<{
    text: string;
    start_time: number;
    end_time: number;
  }>;
}

/**
 * Server error message payload
 */
export interface ServerErrorPayload {
  code: number;
  message: string;
  reqid: string;
}

/**
 * Generic WebSocket message structure
 */
export interface VolcengineMessage<T = unknown> {
  type: ClientMessageType | ServerMessageType;
  payload: T;
}
