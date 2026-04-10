import type { RecognitionResult, VolcengineSettings } from '../../../shared/types/speech';
import type { ServerMessageType, SubtitlePayload } from './protocol';
import {
  createAudioDataMessage,
  createClientFinishMessage,
  createClientReadyMessage,
  decodeServerMessage,
  getVolcengineResourceId,
  getVolcengineWebSocketUrl,
  isServerError,
  isServerReady,
  isSourceSubtitle,
  isTranslationSubtitle,
  toSubtitlePayload,
} from './wire-format';
import { convertSubtitleToResult } from './response';

export interface VolcengineProviderConfig {
  settings: VolcengineSettings;
  sourceLanguage: string;
  targetLanguage: string;
  onResult: (result: RecognitionResult) => void;
  onError: (error: Error) => void;
}

export class VolcengineProvider {
  private ws: WebSocket | null = null;
  private sequence = 1;
  private readonly reqid: string;
  private currentSourceText = '';
  private currentTranslationText = '';

  constructor(private readonly config: VolcengineProviderConfig) {
    this.reqid = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const url = await getVolcengineWebSocketUrl();
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = async () => {
          try {
            const readyMessage = await createClientReadyMessage(
              this.config.sourceLanguage,
              this.config.targetLanguage,
              this.reqid,
            );
            this.ws?.send(readyMessage);
            resolve();
          } catch (error) {
            const actualError = error instanceof Error ? error : new Error(String(error));
            this.config.onError(actualError);
            reject(actualError);
          }
        };

        this.ws.onmessage = async (event) => {
          if (event.data instanceof ArrayBuffer) {
            await this.handleMessage(event.data);
          }
        };

        this.ws.onerror = () => {
          const error = new Error('WebSocket error');
          this.config.onError(error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.ws = null;
        };
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = await createAudioDataMessage(this.sequence++, audioData);
    this.ws.send(message);
  }

  async finish(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(await createClientFinishMessage(this.sequence++));
  }

  disconnect(): void {
    if (!this.ws) {
      return;
    }

    this.ws.close();
    this.ws = null;
  }

  private async handleMessage(data: ArrayBuffer): Promise<void> {
    try {
      const message = await decodeServerMessage(data);

      if (isServerReady(message)) {
        if ((message.response_meta?.status_code ?? 0) >= 400) {
          this.config.onError(new Error(message.response_meta?.message || 'Server error'));
        }
        return;
      }

      if (isServerError(message)) {
        this.config.onError(new Error(message.response_meta?.message || 'Server error'));
        return;
      }

      if (isSourceSubtitle(message)) {
        this.handleSourceSubtitle(String(message.event) as ServerMessageType, toSubtitlePayload(message) as SubtitlePayload);
        return;
      }

      if (isTranslationSubtitle(message)) {
        this.handleTranslationSubtitle(String(message.event) as ServerMessageType, toSubtitlePayload(message) as SubtitlePayload);
      }
    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleSourceSubtitle(type: ServerMessageType, payload: SubtitlePayload): void {
    this.currentSourceText = payload.text;
    this.config.onResult(convertSubtitleToResult(type, payload, this.currentTranslationText || undefined));
  }

  private handleTranslationSubtitle(type: ServerMessageType, payload: SubtitlePayload): void {
    this.currentTranslationText = payload.text;
    const result = convertSubtitleToResult(type, payload, this.currentTranslationText);
    result.sourceText = this.currentSourceText;
    this.config.onResult(result);
  }
}
