import type { RecognitionResult, SpeechSettings } from '../../shared/types/speech';
import {SpeechRecognitionProvider} from "../model/recognition";

interface SpeechRecognitionServiceConfig {
  settings: SpeechSettings;
}

/**
 * Speech recognition service that manages provider lifecycle
 */
export class SpeechRecognitionService implements SpeechRecognitionProvider {
  private isRunning = false;

  constructor(private readonly config: SpeechRecognitionServiceConfig) {}

  /**
   * Starts speech recognition
   */
  async start(onResult: (result: RecognitionResult) => void, onError: (error: Error) => void): Promise<void> {
    if (this.isRunning) {
      throw new Error('Speech recognition already running');
    }

    this.isRunning = true;

    // TODO: Initialize provider connection (WebSocket, etc.)
    // When implementing real provider:
    // 1. Create WebSocket connection
    // 2. Set up message handler:
    //    ws.onmessage = (event) => {
    //      const result = parseProviderResponse(event.data);
    //      this.config.onResult(result);  // ← Call callback here
    //    };
    // 3. Set up error handler:
    //    ws.onerror = (error) => {
    //      this.config.onError(error);  // ← Call error callback here
    //    };

  }

  /**
   * Sends audio data to the recognition provider
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isRunning) {
      console.warn('[SpeechRecognitionService] Cannot send audio: service not running');
      return;
    }

    // TODO: Send audio to provider
  }

  /**
   * Stops speech recognition
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // TODO: Close provider connection
  }
}
