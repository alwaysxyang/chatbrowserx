import { LlmOrchestrator } from '../llm/llm-orchestrator';
import { registerScreenshotCaptureHandler } from './screenshot-capture';
import {
  runtimeErrorResponse,
  toRuntimeResponse,
} from '../../shared/types/runtime-messages';
import {
  chatSessionPortName,
  isChatCancelMessage,
  isChatRequestMessage,
  chatStreamChunkType,
} from '../../shared/types/chat';

const llmOrchestrator = new LlmOrchestrator();

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

    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(runtimeErrorResponse('No tab ID'));
      return true;
    }

    void toRuntimeResponse(llmOrchestrator.complete(tabId, message.payload, (chunk) => {
      if (!chunk) {
        return;
      }

      void chrome.tabs
        .sendMessage(tabId, {
          type: chatStreamChunkType,
          payload: { content: chunk },
        })
        .catch(() => undefined);
    })).then(sendResponse);

    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isChatCancelMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId != null) {
      llmOrchestrator.cancel(tabId);
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
      llmOrchestrator.cancel(tabId);
    });
  });
}
