import { SpeechOrchestrator } from './speech-orchestrator';
import { isSpeechStartRequestMessage, isSpeechStopRequestMessage, toRuntimeResponse } from '../../shared/types/runtime-messages';
import { clearSpeechState } from '../../shared/storage/speech-state-repository';

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
      sendResponse({ ok: false, error: 'No tab ID' });
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
      speechOrchestrator.stop(tabId);
    }

    sendResponse({ ok: true, data: {} });

    return true;
  });

  // Clean up speech state when tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    // Stop speech recognition if running for this tab
    speechOrchestrator.stop(tabId);

    // Clear speech state for this tab
    void clearSpeechState(tabId);
  });

  // Clean up all sessions when extension is suspended or reloaded
  if (chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
      speechOrchestrator.stopAll();
    });
  }
}
