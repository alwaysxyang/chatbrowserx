import type { RecognitionResult } from '../../shared/types/speech';
import type { SpeechSettings } from '../../shared/types/settings';
import type { SpeechRecognitionProvider } from '../model/recognition';
import { VolcengineProvider } from '../providers/volcengine';

interface SpeechRecognitionServiceConfig {
  settings: SpeechSettings;
}

/**
 * Speech recognition service that manages provider lifecycle
 */
export class SpeechRecognitionService implements SpeechRecognitionProvider {
  private provider: SpeechRecognitionProvider | null = null;
  private isRunning = false;

  constructor(private readonly config: SpeechRecognitionServiceConfig) {}

  /**
   * Starts speech recognition
   */
  async start(onResult: (result: RecognitionResult) => void, onError: (error: Error) => void): Promise<void> {
    if (this.isRunning) {
      throw new Error('Speech recognition already running');
    }

    // Create provider based on settings
    this.provider = this.createProvider();

    // Start provider
    await this.provider.start(onResult, onError);

    this.isRunning = true;
  }

  /**
   * Sends audio data to the recognition provider
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isRunning || !this.provider) {
      console.warn('[SpeechRecognitionService] Cannot send audio: service not running');
      return;
    }

    this.provider.sendAudio(audioData);
  }

  /**
   * Stops speech recognition
   */
  stop(): void {
    if (!this.isRunning || !this.provider) {
      return;
    }

    this.provider.stop();
    this.provider = null;
    this.isRunning = false;
  }

  /**
   * Creates provider instance based on settings
   */
  private createProvider(): SpeechRecognitionProvider {
    const { settings } = this.config;

    switch (settings.provider) {
      case 'volcengine':
        return new VolcengineProvider({
          accessKey: settings.volcengine.accessKeyId,
          secretKey: settings.volcengine.secretAccessKey,
          sourceLanguage: settings.sourceLanguage === 'auto' ? 'zh' : settings.sourceLanguage,
          targetLanguages: settings.targetLanguage === 'none' ? [] : [settings.targetLanguage],
        });

      default:
        throw new Error(`Unsupported speech provider: ${settings.provider}`);
    }
  }
}
