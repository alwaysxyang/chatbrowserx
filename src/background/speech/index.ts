import { SpeechOrchestrator } from './speech-orchestrator';
import { runtimeSuccessResponse } from '../../shared/types/runtime-messages';
import {
  isSpeechStartRequestMessage,
  isSpeechStopRequestMessage,
  isSpeechStateQueryMessage,
  type SpeechStateQueryResponse,
} from '../../shared/types/speech';
import { getSenderTabIdOrRespond, sendAsyncRuntimeResponse } from '../runtime-message';

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

    const tabId = getSenderTabIdOrRespond(sender, sendResponse);
    if (tabId == null) {
      return true;
    }

    sendAsyncRuntimeResponse(speechOrchestrator.start(tabId), sendResponse);

    return true;
  });

  // Handle speech stop requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSpeechStopRequestMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    sendAsyncRuntimeResponse(tabId == null ? Promise.resolve() : speechOrchestrator.stop(tabId), sendResponse);

    return true;
  });

  // Handle speech state query requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSpeechStateQueryMessage(message)) {
      return undefined;
    }

    const tabId = getSenderTabIdOrRespond(sender, sendResponse);
    if (tabId == null) {
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
    void speechOrchestrator.stop(tabId);
  });

  // Clean up all sessions when extension is suspended or reloaded
  if (chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
      speechOrchestrator.stopAll();
    });
  }
}
