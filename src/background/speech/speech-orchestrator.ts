import { loadSettings } from '../../shared/storage/settings-repository';
import type { RecognitionResult } from '../../shared/types/speech';
import { speechErrorType, speechResultType } from '../../shared/types/speech';
import { SpeechRecognitionService } from '../../speech/services/speech-recognition';
import { AudioCapture } from './audio-capture';
import type { AudioCaptureConfig } from './audio-config';

interface TabSession {
  audioCapture: AudioCapture;
  recognitionService: SpeechRecognitionService;
}

/**
 * Coordinates tab audio capture and speech recognition sessions.
 */
export class SpeechOrchestrator {
  private sessions = new Map<number, TabSession>();

  /**
   * Starts speech recognition for a tab after loading current speech settings.
   */
  async start(tabId: number): Promise<void> {
    if (this.sessions.has(tabId)) {
      throw new Error(`Speech recognition already running for tab ${tabId}`);
    }

    const settings = await loadSettings();
    const audioCaptureConfig: AudioCaptureConfig = {
      format: 'pcm-int16',
    };
    const audioCapture = new AudioCapture(tabId, audioCaptureConfig);
    const recognitionService = new SpeechRecognitionService({
      settings: settings.speech,
    });

    await recognitionService.start(
      (result: RecognitionResult) => {
        this.handleRecognitionResult(tabId, result);
      },
      (error: Error) => {
        this.handleRecognitionError(tabId, error);
      },
    );
    await audioCapture.start((audioData: ArrayBuffer) => {
      recognitionService.sendAudio(audioData);
    });

    this.sessions.set(tabId, { audioCapture, recognitionService });
  }

  /**
   * Stops speech recognition for a tab when a session exists.
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
   * Checks whether a tab has an active recording session.
   */
  isRecording(tabId: number): boolean {
    return this.sessions.has(tabId);
  }

  /**
   * Stops all active speech recognition sessions.
   */
  stopAll(): void {
    for (const tabId of this.sessions.keys()) {
      this.stop(tabId);
    }
  }

  /**
   * Forwards recognition results to the owning content script.
   */
  private handleRecognitionResult(tabId: number, result: RecognitionResult): void {
    void chrome.tabs.sendMessage(tabId, {
      type: speechResultType,
      payload: result,
    });
  }

  /**
   * Reports recognition errors to the owning content script and tears down the session.
   */
  private handleRecognitionError(tabId: number, error: Error): void {
    console.error(`Speech recognition error for tab ${tabId}:`, error);

    chrome.tabs.sendMessage(tabId, {
      type: speechErrorType,
      payload: {
        error: error.message,
      },
    }).catch(() => {
      // Ignore if tab is closed
    });

    void this.stop(tabId);
  }
}
