const OFFSCREEN_DOCUMENT_PATH = '/src/background/speech/offscreen.html';

/**
 * Captures audio from a browser tab using Chrome's tabCapture API.
 * Uses offscreen document to handle getUserMedia since it's not available in service worker.
 * Each instance manages audio capture for a single tab.
 */
export class AudioCapture {
  private isCapturing = false;
  private messageListener: ((message: any) => void) | null = null;

  constructor(private readonly tabId: number) {}

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

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
      justification: 'Audio capture for speech recognition',
    });
  }

  /**
   * Starts capturing audio from the tab.
   * @param onAudioData - Callback that receives audio data chunks as ArrayBuffer
   * @param chunkInterval - Interval in milliseconds for audio chunks (default: 250ms)
   */
  async start(
    onAudioData: (data: ArrayBuffer) => void,
    chunkInterval: number = 250,
  ): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Audio capture already started');
    }

    // Get stream ID from tabCapture
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

    // Ensure offscreen document exists
    await this.ensureOffscreenDocument();

    // Set up message listener for audio data from offscreen document
    this.messageListener = (message: any) => {
      // Only handle messages for this tab
      if (message.tabId !== this.tabId) {
        return;
      }

      if (message.type === 'audio-data') {
        onAudioData(message.data);
      } else if (message.type === 'audio-error') {
        console.error(`Audio capture error from offscreen for tab ${this.tabId}:`, message.error);
        this.stop();
      } else if (message.type === 'capture-started') {
        this.isCapturing = true;
      }
    };

    chrome.runtime.onMessage.addListener(this.messageListener);

    // Send message to offscreen document to start capture
    await chrome.runtime.sendMessage({
      type: 'start-capture',
      tabId: this.tabId,
      streamId,
      chunkInterval,
    });
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

    // Clean up message listener
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }

    this.isCapturing = false;
  }
}
