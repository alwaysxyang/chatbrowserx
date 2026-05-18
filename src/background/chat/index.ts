import { registerScreenshotCaptureHandler } from './screenshot-capture';
import {
  isChatClearMessage,
  isChatCancelMessage,
  isChatRequestMessage,
  isChatStateQueryMessage,
} from '../../shared/types/chat';
import { sendAsyncRuntimeResponse } from '../runtime-message';
import { ChatSessionCoordinator } from './chat-session-coordinator';

const chatSessionCoordinator = new ChatSessionCoordinator();

/**
 * Initialize chat module
 * Sets up message listeners and screenshot capture
 */
export function initChatModule(): void {
  registerScreenshotCaptureHandler();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isChatRequestMessage(message)) {
      return undefined;
    }

    sendAsyncRuntimeResponse(
      chatSessionCoordinator.request({ pageToolTabId: sender.tab?.id }, message.payload),
      sendResponse,
    );

    return true;
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isChatStateQueryMessage(message)) {
      return undefined;
    }

    sendAsyncRuntimeResponse(chatSessionCoordinator.getState(), sendResponse);

    return true;
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!isChatCancelMessage(message)) {
      return undefined;
    }

    void chatSessionCoordinator.cancel();

    return undefined;
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isChatClearMessage(message)) {
      return;
    }

    sendAsyncRuntimeResponse(chatSessionCoordinator.clear(), sendResponse);

    return true;
  });
}
