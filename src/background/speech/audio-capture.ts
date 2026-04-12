import type { AudioCaptureConfig } from './offscreen';

const OFFSCREEN_DOCUMENT_PATH = '/src/background/speech/offscreen.html';

/**
 * Captures audio from a browser tab using Chrome's tabCapture API.
 * Uses offscreen document to handle getUserMedia since it's not available in service worker.
 * Each instance manages audio capture for a single tab.
 */
export class AudioCapture {
  private isCapturing = false;
  private port?: chrome.runtime.Port;

  constructor(
    private readonly tabId: number,
    private readonly config?: AudioCaptureConfig,
  ) {}

  /**
   * Ensures offscreen document exists for audio capture
   */
  private async ensureOffscreenDocument(): Promise<void> {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });

    if (existingContexts.length > 0) {
      return;
    }

    // Wait for offscreen document to be ready
    const readyPromise = new Promise<void>((resolve) => {
      const listener = (message: any) => {
        if (message.type === 'offscreen-ready') {
          chrome.runtime.onMessage.removeListener(listener);
          resolve();
        }
      };
      chrome.runtime.onMessage.addListener(listener);
    });

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
      justification: 'Audio capture for speech recognition',
    });

    // Wait for ready signal from offscreen document
    await readyPromise;
  }

  /**
   * Starts capturing audio from the tab.
   * @param onAudioData - Callback that receives audio data chunks as ArrayBuffer
   */
  async start(onAudioData: (data: ArrayBuffer) => void): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Audio capture already started');
    }

    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId(
        {
          targetTabId: this.tabId,
        },
        (streamId) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(chrome.runtime.lastError?.message || 'Failed to capture tab audio'),
            );
          } else {
            resolve(streamId);
          }
        },
      );
    });

    await this.ensureOffscreenDocument();

    const portName = `audio-capture-${this.tabId}`;
    const portConnectedPromise = new Promise<chrome.runtime.Port>((resolve) => {
      const listener = (port: chrome.runtime.Port) => {
        if (port.name === portName) {
          chrome.runtime.onConnect.removeListener(listener);
          resolve(port);
        }
      };
      chrome.runtime.onConnect.addListener(listener);
    });

    await chrome.runtime.sendMessage({
      type: 'start-capture',
      tabId: this.tabId,
      streamId,
      config: this.config,
    });

    this.port = await portConnectedPromise;

    this.port.onMessage.addListener((message: any) => {
      if (message.type === 'audio-data') {
        if (!message.data || !Array.isArray(message.data)) {
          console.error('[AudioCapture] Invalid data format:', message.data);
          return;
        }

        const uint8Array = new Uint8Array(message.data);
        const audioData = uint8Array.buffer;

        if (audioData.byteLength === 0) {
          return;
        }
        onAudioData(audioData);
      } else if (message.type === 'audio-error') {
        console.error(`Audio capture error from offscreen:`, message.error);
        this.stop();
      }
    });

    this.port.onDisconnect.addListener(() => {
      this.stop();
    });

    this.isCapturing = true;
  }

  /**
   * Stops capturing audio and cleans up resources.
   */
  stop(): void {
    if (!this.isCapturing) {
      return;
    }

    // Send stop message to offscreen document
    chrome.runtime.sendMessage({
      type: 'stop-capture',
      tabId: this.tabId,
    }).catch(() => {
      // Ignore errors if offscreen document is already closed
    });

    // Disconnect port
    if (this.port) {
      this.port.disconnect();
      this.port = undefined;
    }

    this.isCapturing = false;
  }
}
