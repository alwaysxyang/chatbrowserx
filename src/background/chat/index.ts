import { ChatOrchestrator } from './chat-orchestrator';
import { registerScreenshotCaptureHandler } from './screenshot-capture';
import {
  chatSessionPortName,
  isChatCancelMessage,
  isChatRequestMessage,
  runtimeErrorResponse,
  toRuntimeResponse,
} from '../../shared/types/runtime-messages';

const chatOrchestrator = new ChatOrchestrator();

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

    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(runtimeErrorResponse('No tab ID'));
      return true;
    }

    void toRuntimeResponse(chatOrchestrator.complete(tabId, message.payload)).then(sendResponse);

    return true;
  });

  // Handle explicit cancel requests from the content script
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isChatCancelMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId != null) {
      chatOrchestrator.cancel(tabId);
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
      chatOrchestrator.cancel(tabId);
    });
  });
}
