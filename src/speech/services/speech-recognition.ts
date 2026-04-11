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

  constructor(config: SpeechRecognitionServiceConfig) {
    this.config = config;
  }

  /**
   * Starts speech recognition
   */
  async start(): Promise<void> {
    throw new Error('Speech recognition not implemented');
  }

  sendAudio(_audioData: ArrayBuffer): void {
    throw new Error('Speech recognition not implemented');
  }

  stop(): void {
    // No-op
  }
}
