import { SpeechOrchestrator } from './speech-orchestrator';
import {
  runtimeErrorResponse,
  runtimeSuccessResponse,
  toRuntimeResponse,
} from '../../shared/types/runtime-messages';
import {
  isSpeechStartRequestMessage,
  isSpeechStopRequestMessage,
  isSpeechStateQueryMessage,
  type SpeechStateQueryResponse,
} from '../../shared/types/speech';

const speechOrchestrator = new SpeechOrchestrator();

/**
 * Initialize speech recognition module
 * Sets up message listeners and tab cleanup
 */
export function initSpeechModule(): void {
  // Handle speech start requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSpeechStartRequestMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(runtimeErrorResponse('No tab ID'));
      return true;
    }

    void toRuntimeResponse(speechOrchestrator.start(tabId)).then(sendResponse);

    return true;
  });

  // Handle speech stop requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSpeechStopRequestMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId != null) {
      void speechOrchestrator.stop(tabId).then(() => {
        sendResponse(runtimeSuccessResponse());
      });
    } else {
      sendResponse(runtimeSuccessResponse());
    }

    return true;
  });

  // Handle speech state query requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSpeechStateQueryMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(runtimeErrorResponse('No tab ID'));
      return true;
    }

    // Return in-memory state (true source of truth)
    const isRecording = speechOrchestrator.isRecording(tabId);
    const response: SpeechStateQueryResponse = runtimeSuccessResponse({
      isRecording,
    });
    sendResponse(response);

    return true;
  });

  // Clean up speech state when tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    // Stop speech recognition and clean up storage
    void speechOrchestrator.cleanup(tabId);
  });

  // Clean up all sessions when extension is suspended or reloaded
  if (chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
      speechOrchestrator.stopAll();
    });
  }
}
