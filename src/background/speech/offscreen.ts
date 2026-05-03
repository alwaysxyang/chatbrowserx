/**
 * Offscreen document for audio capture.
 * Handles getUserMedia calls that cannot be made in service worker context.
 * Keep this file lightweight because it runs in a separate offscreen document.
 */

import { normalizeAudioCaptureConfig, type AudioCaptureConfig } from './audio-config';

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
  port?: chrome.runtime.Port;
}

const sessions = new Map<number, CaptureSession>();

interface ChromeTabAudioConstraints extends MediaTrackConstraints {
  mandatory: {
    chromeMediaSource: 'tab';
    chromeMediaSourceId: string;
  };
}

/**
 * Starts capturing audio using the provided stream ID
 *
 * @param tabId - Tab that owns the capture session.
 * @param streamId - Chrome tab capture stream id.
 * @param config - Audio capture config.
 */
async function startCapture(tabId: number, streamId: string, config: AudioCaptureConfig): Promise<void> {
  if (sessions.has(tabId)) {
    throw new Error(`Audio capture already started for tab ${tabId}`);
  }
  const normalizedConfig = normalizeAudioCaptureConfig(config);

  const port = chrome.runtime.connect({ name: `audio-capture-${tabId}` });
  const audioConstraints: ChromeTabAudioConstraints = {
    mandatory: {
      chromeMediaSource: 'tab',
      chromeMediaSourceId: streamId,
    },
  };

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
    video: false,
  });

  const audioContext = new AudioContext({
    // sampleRate: config.sampleRate,
    // latencyHint: 'interactive',
  });
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);

  // Connect source to destination to maintain audio playback
  sourceNode.connect(audioContext.destination);

  if (normalizedConfig.format === 'webm') {
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

    recorder.start(normalizedConfig.chunkInterval);

    sessions.set(tabId, { mediaStream, audioContext, sourceNode, recorder, config: normalizedConfig, port });
  } else {
    await audioContext.audioWorklet.addModule(
      chrome.runtime.getURL('src/background/speech/audio-processor.js')
    );

    const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: {
        format: normalizedConfig.format,
        targetSampleRate: normalizedConfig.sampleRate,
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

    sessions.set(tabId, { mediaStream, audioContext, sourceNode, workletNode, config: normalizedConfig, port });
  }

  void chrome.runtime.sendMessage({
    type: 'capture-started',
    tabId,
  });
}

/**
 * Stops capturing audio and cleans up resources
 *
 * @param tabId - Tab whose capture session should stop.
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

if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
  try {
    chrome.runtime.sendMessage({ type: 'offscreen-ready' })?.catch(() => {
      // Ignore the readiness ping when the background script is not ready yet.
    });
  } catch {
    // Ignore readiness ping errors in test environments.
  }
}
