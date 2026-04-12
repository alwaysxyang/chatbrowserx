/**
 * Offscreen document for audio capture.
 * Handles getUserMedia calls that cannot be made in service worker context.
 * 需要保持足够轻量，因为是单独渲染，所以风格会跟项目其他地方有不一致
 */

export interface AudioCaptureConfig {
  sampleRate?: number;
  format?: 'pcm-int16' | 'pcm-float32' | 'webm';
  chunkInterval?: number;
}

export const defaultAudioCaptureConfig: AudioCaptureConfig = {
  sampleRate: 16000,
  format: 'webm',
  chunkInterval: 250,
};

/**
 * Normalizes audio capture configuration by applying defaults
 */
export function normalizeAudioCaptureConfig(
    config?: AudioCaptureConfig,
): AudioCaptureConfig {
  return {
    sampleRate: config?.sampleRate ?? defaultAudioCaptureConfig.sampleRate,
    format: config?.format ?? defaultAudioCaptureConfig.format,
    chunkInterval: config?.chunkInterval ?? defaultAudioCaptureConfig.chunkInterval,
  };
}

interface StartCaptureMessage {
  type: 'start-capture';
  tabId: number;
  streamId: string;
  config: AudioCaptureConfig;
}

interface StopCaptureMessage {
  type: 'stop-capture';
  tabId: number;
}

type OffscreenMessage = StartCaptureMessage | StopCaptureMessage;

interface CaptureSession {
  mediaStream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  workletNode?: AudioWorkletNode;
  recorder?: MediaRecorder;
  config: AudioCaptureConfig;
}

// Support multiple tabs simultaneously
const sessions = new Map<number, CaptureSession>();

/**
 * Starts capturing audio using the provided stream ID
 */
async function startCapture(tabId: number, streamId: string, config: AudioCaptureConfig): Promise<void> {
  if (sessions.has(tabId)) {
    throw new Error(`Audio capture already started for tab ${tabId}`);
  }
  config = normalizeAudioCaptureConfig(config);

  // Get media stream using the stream ID from tabCapture
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    } as any,
    video: false,
  });

  // Create audio context with specified sample rate
  const audioContext = new AudioContext({
    sampleRate: config.sampleRate,
    latencyHint: 'interactive',
  });
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);

  if (config.format === 'webm') {
    // Use MediaRecorder for WebM format
    sourceNode.connect(audioContext.destination);

    const recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
    recorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size > 0) {
        const buffer = await event.data.arrayBuffer();
        void chrome.runtime.sendMessage({
          type: 'audio-data',
          tabId,
          data: buffer,
        });
      }
    };

    recorder.onerror = (event: Event) => {
      console.error(`MediaRecorder error for tab ${tabId}:`, event);
      chrome.runtime.sendMessage({
        type: 'audio-error',
        tabId,
        error: 'MediaRecorder error',
      });
    };

    recorder.start(config.chunkInterval);

    sessions.set(tabId, { mediaStream, audioContext, sourceNode, recorder, config });
  } else {
    // Use AudioWorklet for PCM formats
    // Load AudioWorklet module
    await audioContext.audioWorklet.addModule(
      chrome.runtime.getURL('src/background/speech/audio-processor.js')
    );

    // Create AudioWorklet node
    const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        format: config.format,
      },
    });

    // Listen for audio data from AudioWorklet
    workletNode.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'audio-data') {
        void chrome.runtime.sendMessage({
          type: 'audio-data',
          tabId,
          data: event.data.data,
        });
      }
    };

    // Connect audio nodes
    sourceNode.connect(workletNode);
    workletNode.connect(audioContext.destination);

    sessions.set(tabId, { mediaStream, audioContext, sourceNode, workletNode, config });
  }

  // Notify service worker that capture started successfully
  void chrome.runtime.sendMessage({
    type: 'capture-started',
    tabId,
  });
}

/**
 * Stops capturing audio and cleans up resources
 */
function stopCapture(tabId: number): void {
  const session = sessions.get(tabId);
  if (!session) {
    return;
  }

  const { recorder, workletNode, sourceNode, audioContext, mediaStream } = session;

  if (recorder) {
    recorder.ondataavailable = null;
    recorder.onerror = null;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  if (workletNode) {
    workletNode.port.onmessage = null;
    workletNode.port.close();
    workletNode.disconnect();
  }

  if (sourceNode) {
    sourceNode.disconnect();
  }

  if (audioContext) {
    void audioContext.close();
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  sessions.delete(tabId);

  // Notify service worker that capture stopped
  void chrome.runtime.sendMessage({
    type: 'capture-stopped',
    tabId,
  });
}

/**
 * Message handler for offscreen document
 */
chrome.runtime.onMessage.addListener((message: OffscreenMessage) => {
  if (message.type === 'start-capture') {
    startCapture(message.tabId, message.streamId, message.config).catch((error) => {
      console.error(`Failed to start capture for tab ${message.tabId}:`, error);
      void chrome.runtime.sendMessage({
        type: 'audio-error',
        tabId: message.tabId,
        error: error.message || 'Failed to start capture',
      });
    });
  } else if (message.type === 'stop-capture') {
    stopCapture(message.tabId);
  }
});

// Notify background that offscreen document is ready
chrome.runtime.sendMessage({ type: 'offscreen-ready' }).catch(() => {
  // Ignore error if background script is not ready yet
});
