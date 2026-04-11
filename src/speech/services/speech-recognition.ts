import type { RecognitionResult, SpeechSettings } from '../../shared/types/speech';

export interface SpeechRecognitionServiceConfig {
  settings: SpeechSettings;
  onResult: (result: RecognitionResult) => void;
  onError: (error: Error) => void;
}

/**
 * Speech recognition service that manages provider lifecycle
 */
export class SpeechRecognitionService {
  private config: SpeechRecognitionServiceConfig;
  private isRunning = false;

  constructor(config: SpeechRecognitionServiceConfig) {
    this.config = config;
  }

  /**
   * Starts speech recognition
   */
  async start(): Promise<void> {
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

    console.log('[SpeechRecognitionService] Started with settings:', this.config.settings);
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
    console.log('[SpeechRecognitionService] Received audio chunk:', audioData.byteLength, 'bytes');
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
    console.log('[SpeechRecognitionService] Stopped');
  }
}
