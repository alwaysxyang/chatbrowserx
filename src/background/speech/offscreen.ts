/**
 * Offscreen document for audio capture.
 * Handles getUserMedia calls that cannot be made in service worker context.
 */

interface StartCaptureMessage {
  type: 'start-capture';
  tabId: number;
  streamId: string;
  chunkInterval: number;
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
  recorder: MediaRecorder;
}

// Support multiple tabs simultaneously
const sessions = new Map<number, CaptureSession>();

/**
 * Starts capturing audio using the provided stream ID
 */
async function startCapture(tabId: number, streamId: string, chunkInterval: number): Promise<void> {
  if (sessions.has(tabId)) {
    throw new Error(`Audio capture already started for tab ${tabId}`);
  }

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

  // Create audio context to keep the stream active
  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);
  sourceNode.connect(audioContext.destination);

  // Use MediaRecorder to capture audio chunks
  const recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

  recorder.ondataavailable = async (event: BlobEvent) => {
    if (event.data.size > 0) {
      const buffer = await event.data.arrayBuffer();
      // Send audio data back to service worker with tabId
      chrome.runtime.sendMessage({
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

  recorder.start(chunkInterval);

  // Store session
  sessions.set(tabId, { mediaStream, audioContext, sourceNode, recorder });

  // Notify service worker that capture started successfully
  chrome.runtime.sendMessage({
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

  const { recorder, sourceNode, audioContext, mediaStream } = session;

  if (recorder) {
    recorder.ondataavailable = null;
    recorder.onerror = null;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
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
  chrome.runtime.sendMessage({
    type: 'capture-stopped',
    tabId,
  });
}

/**
 * Message handler for offscreen document
 */
chrome.runtime.onMessage.addListener((message: OffscreenMessage) => {
  if (message.type === 'start-capture') {
    startCapture(message.tabId, message.streamId, message.chunkInterval).catch((error) => {
      console.error(`Failed to start capture for tab ${message.tabId}:`, error);
      chrome.runtime.sendMessage({
        type: 'audio-error',
        tabId: message.tabId,
        error: error.message || 'Failed to start capture',
      });
    });
  } else if (message.type === 'stop-capture') {
    stopCapture(message.tabId);
  }
});
