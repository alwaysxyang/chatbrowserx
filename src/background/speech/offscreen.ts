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
  port?: chrome.runtime.Port; // Long-lived connection for audio data
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

  const port = chrome.runtime.connect({ name: `audio-capture-${tabId}` });

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    } as any,
    video: false,
  });

  const audioContext = new AudioContext({
    // sampleRate: config.sampleRate,
    // latencyHint: 'interactive',
  });
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);

  // Connect source to destination to maintain audio playback
  sourceNode.connect(audioContext.destination);

  if (config.format === 'webm') {
    const recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
    recorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size > 0) {
        const buffer = await event.data.arrayBuffer();
        const dataArray = Array.from(new Uint8Array(buffer));
        port.postMessage({
          type: 'audio-data',
          data: dataArray,
        });
      }
    };

    recorder.onerror = (event: Event) => {
      console.error(`MediaRecorder error for tab ${tabId}:`, event);
      port.postMessage({
        type: 'audio-error',
        error: 'MediaRecorder error',
      });
    };

    recorder.start(config.chunkInterval);

    sessions.set(tabId, { mediaStream, audioContext, sourceNode, recorder, config, port });
  } else {
    await audioContext.audioWorklet.addModule(
      chrome.runtime.getURL('src/background/speech/audio-processor.js')
    );

    const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: {
        format: config.format,
        targetSampleRate: config.sampleRate,
      },
    });

    workletNode.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'audio-data') {
        const data = event.data.data;
        const dataSize = data?.byteLength || 0;

        if (dataSize === 0) {
          return;
        }

        const dataArray = Array.from(new Uint8Array(data));
        port.postMessage({
          type: 'audio-data',
          data: dataArray,
        });
      }
    };

    sourceNode.connect(workletNode);

    sessions.set(tabId, { mediaStream, audioContext, sourceNode, workletNode, config, port });
  }

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
if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
  try {
    chrome.runtime.sendMessage({ type: 'offscreen-ready' })?.catch(() => {
      // Ignore error if background script is not ready yet
    });
  } catch {
    // Ignore error in test environment
  }
}
