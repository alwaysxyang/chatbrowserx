import { handleChatRequest, cancelChatRequest } from './chat/chat-orchestrator';
import { chatSessionPortName, isChatRequestMessage, isChatCancelMessage, panelCommandType } from '../shared/types/runtime-messages';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isChatRequestMessage(message)) {
    return undefined;
  }

  handleChatRequest(message.payload, sender.tab?.id)
    .then((data) => {
      sendResponse({ ok: true, data });
    })
    .catch((error: Error) => {
      sendResponse({ ok: false, error: error.message });
    });

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
