/**
 * Captures audio from a browser tab using Chrome's tabCapture API and converts it to PCM 16k mono.
 */
export class AudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private pendingSamples: number[] = [];
  private readonly chunkSampleCount = 4000; // ~250ms at 16kHz

  /**
   * Starts capturing audio from the current tab.
   */
  async start(_tabId: number, onAudioData: (data: ArrayBuffer) => void): Promise<void> {
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

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    await this.audioContext.audioWorklet.addModule(chrome.runtime.getURL('src/background/speech/pcm-capture-worklet.js'));

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor');

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.handleFloatSamples(event.data, onAudioData);
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  /**
   * Stops capturing audio and cleans up resources.
   */
  stop(): void {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
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

    this.pendingSamples = [];
  }

  private handleFloatSamples(input: Float32Array, onAudioData: (data: ArrayBuffer) => void): void {
    for (let index = 0; index < input.length; index += 1) {
      this.pendingSamples.push(input[index]);
    }

    while (this.pendingSamples.length >= this.chunkSampleCount) {
      const chunk = this.pendingSamples.splice(0, this.chunkSampleCount);
      const pcmData = new Int16Array(chunk.length);

      for (let index = 0; index < chunk.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, chunk[index]));
        pcmData[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      onAudioData(pcmData.buffer);
    }
  }
}
