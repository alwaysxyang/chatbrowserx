

/**
 * Response payload for speech state query.
 */
export interface SpeechStateQueryResponsePayload {
  isRecording: boolean;
}

export interface RecognitionResult {
  sourceText: string;
  translationText?: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}
