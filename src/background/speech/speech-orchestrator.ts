import type { RecognitionResult } from '../../shared/types/speech';
import { loadSpeechSettings } from '../../shared/storage/speech-settings-repository';
import { SpeechRecognitionService } from '../../speech/services/speech-recognition';
import { AudioCapture } from './audio-capture';
import { speechResultType } from '../../shared/types/runtime-messages';

interface TabSession {
  audioCapture: AudioCapture;
  recognitionService: SpeechRecognitionService;
}

/**
 * Orchestrates speech recognition by coordinating audio capture and recognition service
 * Supports multiple tabs simultaneously
 */
export class SpeechOrchestrator {
  private sessions = new Map<number, TabSession>();

  /**
   * Starts speech recognition for the specified tab
   */
  async start(tabId: number): Promise<void> {
    if (this.sessions.has(tabId)) {
      throw new Error(`Speech recognition already running for tab ${tabId}`);
    }

    // Load settings
    const settings = await loadSpeechSettings();

    // Validate settings
    if (!settings.volcengine.accessKeyId || !settings.volcengine.secretAccessKey) {
      throw new Error('Volcengine credentials not configured');
    }

    // Initialize audio capture
    const audioCapture = new AudioCapture();

    // Initialize recognition service
    const recognitionService = new SpeechRecognitionService({
      settings,
      onResult: (result: RecognitionResult) => {
        this.handleRecognitionResult(tabId, result);
      },
      onError: (error: Error) => {
        this.handleRecognitionError(tabId, error);
      },
    });

    // Start recognition service
    await recognitionService.start();

    // Start audio capture
    await audioCapture.start((audioData: ArrayBuffer) => {
      recognitionService.sendAudio(audioData);
    });

    // Store session
    this.sessions.set(tabId, { audioCapture, recognitionService });
  }

  /**
   * Stops speech recognition for the specified tab
   */
  stop(tabId: number): void {
    const session = this.sessions.get(tabId);
    if (!session) {
      return;
    }

    session.recognitionService.stop();
    session.audioCapture.stop();

    this.sessions.delete(tabId);
  }

  /**
   * Stops all active speech recognition sessions
   */
  stopAll(): void {
    for (const tabId of this.sessions.keys()) {
      this.stop(tabId);
    }
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
    console.error(`Speech recognition error for tab ${tabId}:`, error);
    this.stop(tabId);
  }
}
