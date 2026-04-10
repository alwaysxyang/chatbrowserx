import type { RecognitionResult } from '../../shared/types/speech';
import { loadSpeechSettings } from '../../shared/storage/speech-settings-repository';
import { SpeechRecognitionService } from '../../speech/services/speech-recognition';
import { AudioCapture } from './audio-capture';
import { speechResultType } from '../../shared/types/runtime-messages';

/**
 * Orchestrates speech recognition by coordinating audio capture and recognition service
 */
export class SpeechOrchestrator {
  private audioCapture: AudioCapture | null = null;
  private recognitionService: SpeechRecognitionService | null = null;
  private isRunning = false;

  /**
   * Starts speech recognition for the specified tab
   */
  async start(tabId: number): Promise<void> {
    if (this.isRunning) {
      throw new Error('Speech recognition already running');
    }

    // Load settings
    const settings = await loadSpeechSettings();

    // Validate settings
    if (!settings.volcengine.appKey || !settings.volcengine.accessKey) {
      throw new Error('Volcengine credentials not configured');
    }

    // Initialize audio capture
    this.audioCapture = new AudioCapture();

    // Initialize recognition service
    this.recognitionService = new SpeechRecognitionService({
      settings,
      onResult: (result: RecognitionResult) => {
        this.handleRecognitionResult(tabId, result);
      },
      onError: (error: Error) => {
        this.handleRecognitionError(tabId, error);
      },
    });

    // Start recognition service
    await this.recognitionService.start();

    // Start audio capture
    await this.audioCapture.start(tabId, (audioData: ArrayBuffer) => {
      if (this.recognitionService) {
        this.recognitionService.sendAudio(audioData);
      }
    });

    this.isRunning = true;
  }

  /**
   * Stops speech recognition
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.recognitionService) {
      this.recognitionService.stop();
      this.recognitionService = null;
    }

    if (this.audioCapture) {
      this.audioCapture.stop();
      this.audioCapture = null;
    }

    this.isRunning = false;
  }

  /**
   * Handles recognition results by forwarding to the content script
   */
  private handleRecognitionResult(tabId: number, result: RecognitionResult): void {
    chrome.tabs.sendMessage(tabId, {
      type: speechResultType,
      payload: result,
    });
  }

  /**
   * Handles recognition errors
   */
  private handleRecognitionError(tabId: number, error: Error): void {
    console.error('Speech recognition error:', error);
    this.stop();
  }
}
