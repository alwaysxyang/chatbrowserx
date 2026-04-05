import { handleChatRequest } from './chat/chat-orchestrator';
import { isChatRequestMessage, panelCommandType } from '../shared/types/runtime-messages';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isChatRequestMessage(message)) {
    return undefined;
  }

  handleChatRequest(message.payload)
    .then((data) => {
      sendResponse({ ok: true, data });
    })
    .catch((error: Error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
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
