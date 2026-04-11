/**
 * Captures audio from a browser tab using Chrome's tabCapture API.
 * Provides audio chunks via callback for provider-specific processing.
 */
export class AudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;

  /**
   * Starts capturing audio from the current tab.
   * @param onAudioData - Callback that receives audio data chunks as ArrayBuffer
   * @param chunkInterval - Interval in milliseconds for audio chunks (default: 250ms)
   */
  async start(
    onAudioData: (data: ArrayBuffer) => void,
    chunkInterval: number = 250,
  ): Promise<void> {
    if (this.mediaStream) {
      throw new Error('Audio capture already started');
    }

    this.mediaStream = await new Promise<MediaStream>((resolve, reject) => {
      chrome.tabCapture.capture(
        {
          audio: true,
          video: false,
        },
        (stream) => {
          if (chrome.runtime.lastError || !stream) {
            reject(new Error(chrome.runtime.lastError?.message || 'Failed to capture tab audio'));
            return;
          }

          resolve(stream);
        },
      );
    });

    // Create audio context to keep the stream active
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.audioContext.destination);

    // Use MediaRecorder to capture audio chunks
    this.recorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });

    this.recorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size > 0) {
        const buffer = await event.data.arrayBuffer();
        onAudioData(buffer);
      }
    };

    this.recorder.start(chunkInterval);
  }

  /**
   * Stops capturing audio and cleans up resources.
   */
  stop(): void {
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      if (this.recorder.state !== 'inactive') {
        this.recorder.stop();
      }
      this.recorder = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Checks if audio capture is currently active.
   */
  isActive(): boolean {
    return this.mediaStream !== null && this.recorder !== null;
  }
}
