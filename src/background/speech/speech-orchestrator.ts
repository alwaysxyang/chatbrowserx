import type { RecognitionResult } from '../../shared/types/speech';
import { SpeechRecognitionService } from '../../speech/services/speech-recognition';
import { AudioCapture } from './audio-capture';
import type { AudioCaptureConfig } from './audio-config';
import { speechResultType } from '../../shared/types/speech';
import {loadSettings} from "../../shared/storage/settings-repository";

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
    const settings = await loadSettings();

    // Audio capture configuration optimized for speech recognition
    const audioCaptureConfig: AudioCaptureConfig = {
      format: 'pcm-int16',    // 16-bit PCM
    };

    // Initialize audio capture for this tab
    const audioCapture = new AudioCapture(tabId, audioCaptureConfig);

    // Initialize recognition service
    const recognitionService = new SpeechRecognitionService({
      settings: settings.speech,
    });

    // Start recognition service
    await recognitionService.start((result: RecognitionResult) => {
      this.handleRecognitionResult(tabId, result);
    }, (error: Error) => {
      this.handleRecognitionError(tabId, error);
    });

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
  async stop(tabId: number): Promise<void> {
    const session = this.sessions.get(tabId);
    if (!session) {
      return;
    }

    session.recognitionService.stop();
    session.audioCapture.stop();

    this.sessions.delete(tabId);
  }

  /**
   * Checks if a tab has an active recording session
   */
  isRecording(tabId: number): boolean {
    return this.sessions.has(tabId);
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
   * Cleans up session (called when tab closes)
   */
  cleanup(tabId: number): void {
    const session = this.sessions.get(tabId);
    if (session) {
      session.recognitionService.stop();
      session.audioCapture.stop();
      this.sessions.delete(tabId);
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
    void this.stop(tabId);
  }
}
