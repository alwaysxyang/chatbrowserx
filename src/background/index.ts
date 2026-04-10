import { handleChatRequest, cancelChatRequest } from './chat/chat-orchestrator';
import { registerScreenshotCaptureHandler } from './chat/screenshot-capture';
import { chatSessionPortName, isChatRequestMessage, isChatCancelMessage, panelCommandType, toRuntimeResponse, isSpeechStartRequestMessage, isSpeechStopRequestMessage } from '../shared/types/runtime-messages';
import { SpeechOrchestrator } from './speech/speech-orchestrator';

registerScreenshotCaptureHandler();

const speechOrchestrator = new SpeechOrchestrator();

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

  speechOrchestrator.stop();
  sendResponse({ ok: true, data: {} });

  return true;
});
