import { handleChatRequest, cancelChatRequest } from './chat-orchestrator';
import { registerScreenshotCaptureHandler } from './screenshot-capture';
import { chatSessionPortName, isChatRequestMessage, isChatCancelMessage, toRuntimeResponse } from '../../shared/types/runtime-messages';

/**
 * Initialize chat module
 * Sets up message listeners and screenshot capture
 */
export function initChatModule(): void {
  // Register screenshot capture handler
  registerScreenshotCaptureHandler();

  // Handle chat requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isChatRequestMessage(message)) {
      return undefined;
    }

    void toRuntimeResponse(handleChatRequest(message.payload, sender.tab?.id)).then(sendResponse);

    return true;
  });

  // Handle explicit cancel requests from the content script
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isChatCancelMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId != null) {
      cancelChatRequest(tabId);
    }

    return undefined;
  });

  // Handle chat session port connections
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== chatSessionPortName) {
      return;
    }

    const tabId = port.sender?.tab?.id;
    if (tabId == null) {
      return;
    }

    port.onDisconnect.addListener(() => {
      cancelChatRequest(tabId);
    });
  });
}
