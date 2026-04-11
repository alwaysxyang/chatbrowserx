import type {RecognitionResult} from "../../shared/types/speech";

export interface SpeechRecognitionProvider {
  /**
   * Starts speech recognition session.
   * Establishes connection to the service and prepares for audio streaming.
   *
   * @returns Promise that resolves when the session is ready
   * @throws Error if connection fails or provider is misconfigured
   */
  start(onResult: (result: RecognitionResult) => void, onError: (error: Error) => void): Promise<void>;

  /**
   * Sends audio data to the recognition service for processing.
   * Audio must match the format specified in the provider config.
   * Can be called multiple times to stream audio chunks.
   *
   * @param audioData - Raw audio data in the required format
   */
  sendAudio(audioData: ArrayBuffer): void;

  /**
   * Stops speech recognition session.
   * Closes the connection and cleans up resources.
   */
  stop(): void;
}
