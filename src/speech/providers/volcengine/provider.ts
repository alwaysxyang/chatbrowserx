import type { RecognitionResult } from '../../../shared/types/speech';
import type { SpeechRecognitionProvider } from '../../model/recognition';
import { getSignedWebSocketUrl } from './signer';

export interface VolcengineConfig {
  accessKey: string;
  secretKey: string;
  sourceLanguage: string;
  targetLanguages: string[];
  hotWordList?: Array<{ Word: string; Scale: number }>;
}

interface VolcengineSubtitle {
  Text: string;
  BeginTime: number;
  EndTime: number;
  Definite: boolean;
  Language: string;
  Sequence: number;
}

interface VolcengineResponse {
  Subtitle?: VolcengineSubtitle;
  ResponseMetadata?: {
    RequestId: string;
    Error?: {
      Code: string;
      Message: string;
    };
  };
}

/**
 * Volcengine (Doubao) speech recognition provider
 * Uses WebSocket for real-time speech translation
 */
export class VolcengineProvider implements SpeechRecognitionProvider {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private onResultCallback: ((result: RecognitionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private lastTranslation: string | undefined = undefined;

  constructor(private readonly config: VolcengineConfig) {}

  async start(
    onResult: (result: RecognitionResult) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    if (this.isConnected) {
      throw new Error('Volcengine provider already started');
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    try {
      const wsUrl = this.getSignedWebSocketUrl();

      this.ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout (5s). Please check your network and API credentials.'));
        }, 5000);

        this.ws!.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        this.ws!.addEventListener('error', (event) => {
          clearTimeout(timeout);
          const errorMsg = event instanceof ErrorEvent && event.message
            ? `WebSocket connection failed: ${event.message}`
            : 'WebSocket connection failed. Please check your network, API credentials (accessKeyId/secretAccessKey), and ensure the Volcengine API is accessible.';
          reject(new Error(errorMsg));
        }, { once: true });
      });

      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (event) => this.handleError(event);
      this.ws.onclose = () => this.handleClose();

      this.handleOpen();
    } catch (error) {
      console.error('[VolcengineProvider] Start failed:', error);
      this.cleanup();
      throw error;
    }
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    if (!audioData || audioData.byteLength === 0) {
      return;
    }

    try {
      const base64Audio = this.arrayBufferToBase64(audioData);

      const audioPacket = {
        AudioData: base64Audio,
      };
      this.ws.send(JSON.stringify(audioPacket));
    } catch (error) {
      console.error('[VolcengineProvider] Failed to send audio:', error);
      this.onErrorCallback?.(error as Error);
    }
  }

  stop(): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    try {
      const endPacket = {
        End: true,
      };
      this.ws.send(JSON.stringify(endPacket));
    } catch (error) {
      console.error('[VolcengineProvider] Failed to send end packet:', error);
    }

    this.cleanup();
  }

  private handleOpen(): void {
    this.isConnected = true;

    const configPacket = {
      Configuration: {
        SourceLanguage: this.config.sourceLanguage,
        TargetLanguages: this.config.targetLanguages,
        HotWordList: this.config.hotWordList || [],
      },
    };

    this.ws!.send(JSON.stringify(configPacket));
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      let data: string;

      if (event.data instanceof Blob) {
        data = await event.data.text();
      } else {
        data = event.data;
      }

      const response: VolcengineResponse = JSON.parse(data);

      if (response.ResponseMetadata?.Error) {
        const error = new Error(
          `Volcengine API error: ${response.ResponseMetadata.Error.Code} - ${response.ResponseMetadata.Error.Message}`,
        );
        console.error('[VolcengineProvider] API error:', error);
        this.onErrorCallback?.(error);
        return;
      }

      if (response.Subtitle) {
        const subtitle = response.Subtitle;

        // Check if this is source or translation
        if (subtitle.Language === this.config.sourceLanguage) {
          // Source text - emit immediately with last known translation
          const result: RecognitionResult = {
            sourceText: subtitle.Text,
            translationText: this.lastTranslation,
            startTime: subtitle.BeginTime,
            endTime: subtitle.EndTime,
            isFinal: subtitle.Definite,
          };
          this.onResultCallback?.(result);
        } else if (this.config.targetLanguages.includes(subtitle.Language)) {
          // Translation text - update last translation
          this.lastTranslation = subtitle.Text;
        }
      }
    } catch (error) {
      console.error('[VolcengineProvider] Failed to parse message:', error);
      this.onErrorCallback?.(error as Error);
    }
  }

  private handleError(event: Event): void {
    console.error('[VolcengineProvider] WebSocket error:', event);

    let errorMsg = 'WebSocket error occurred';

    if (event instanceof ErrorEvent) {
      errorMsg = `WebSocket error: ${event.message || 'Unknown error'}`;
    }

    // Add helpful context
    if (!this.isConnected) {
      errorMsg += '. Connection was not established. Please verify your API credentials and network connectivity.';
    }

    const error = new Error(errorMsg);
    this.onErrorCallback?.(error);
  }

  private handleClose(): void {
    console.log('[VolcengineProvider] WebSocket closed');
    this.cleanup();
  }

  private cleanup(): void {
    this.isConnected = false;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      this.ws.close();
      this.ws = null;
    }

    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.lastTranslation = undefined;
  }

  private getSignedWebSocketUrl(): string {
    return getSignedWebSocketUrl({
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      region: 'cn-north-1',
      service: 'translate',
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
