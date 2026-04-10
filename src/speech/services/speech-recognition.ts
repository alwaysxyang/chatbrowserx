import type { RecognitionResult, SpeechSettings } from '../../shared/types/speech';
import { VolcengineProvider } from '../providers/volcengine/provider';

export interface SpeechRecognitionServiceConfig {
  settings: SpeechSettings;
  onResult: (result: RecognitionResult) => void;
  onError: (error: Error) => void;
}

/**
 * Speech recognition service that manages provider lifecycle
 */
export class SpeechRecognitionService {
  private provider: VolcengineProvider | null = null;
  private config: SpeechRecognitionServiceConfig;

  constructor(config: SpeechRecognitionServiceConfig) {
    this.config = config;
  }

  /**
   * Starts speech recognition
   */
  async start(): Promise<void> {
    if (this.provider) {
      throw new Error('Recognition already started');
    }

    const { settings } = this.config;

    const sourceLanguage = this.mapLanguageCode(settings.sourceLanguage);
    const targetLanguage = settings.targetLanguage === 'none' ? '' : this.mapLanguageCode(settings.targetLanguage);

    this.provider = new VolcengineProvider({
      settings: settings.volcengine,
      sourceLanguage,
      targetLanguage,
      onResult: this.config.onResult,
      onError: this.config.onError,
    });

    await this.provider.connect();
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (!this.provider) {
      throw new Error('Recognition not started');
    }

    this.provider.sendAudio(audioData);
  }

  stop(): void {
    if (this.provider) {
      this.provider.finish();
      this.provider.disconnect();
      this.provider = null;
    }
  }

  private mapLanguageCode(lang: string): string {
    const mapping: Record<string, string> = {
      auto: 'zhen',
      zh: 'zh',
      en: 'en',
      ja: 'ja',
      none: '',
    };

    return mapping[lang] || lang;
  }
}
