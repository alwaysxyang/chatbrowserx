import { handleChatRequest, cancelChatRequest } from './chat/chat-orchestrator';
import { registerScreenshotCaptureHandler } from './chat/screenshot-capture';
import { chatSessionPortName, isChatRequestMessage, isChatCancelMessage, panelCommandType, toRuntimeResponse } from '../shared/types/runtime-messages';

registerScreenshotCaptureHandler();

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

chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;

  if (tabId == null) {
    return;
  }

  void chrome.tabs
    .sendMessage(tabId, {
      type: panelCommandType,
      payload: { command: 'toggle-chat' },
    })
    .catch(() => undefined);
});
