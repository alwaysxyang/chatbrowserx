import { LlmOrchestrator } from '../llm/llm-orchestrator';
import { chatSessionPortName } from '../../shared/types/chat';
import type { SelectionResponsePayload, SelectionRuntimeResponse } from '../../shared/types/selection';
import {
  isSelectionCancelMessage,
  isSelectionRequestMessage,
  selectionStreamChunkType,
} from '../../shared/types/selection';
import { getSenderTabIdOrRespond, sendAsyncRuntimeResponse } from '../runtime-message';

const llmOrchestrator = new LlmOrchestrator();

/**
 * Initialize selection module.
 * Wires selection runtime messages to background LLM orchestration with streaming chunk forwarding.
 */
export function initSelectionModule(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSelectionRequestMessage(message)) {
      return undefined;
    }

    const tabId = getSenderTabIdOrRespond(sender, sendResponse);
    if (tabId == null) {
      return true;
    }

    const { requestId, prompt } = message.payload;

    sendAsyncRuntimeResponse<SelectionResponsePayload>(
      llmOrchestrator
        .complete(
          undefined,
          tabId,
          { history: [], input: prompt },
          (chunk) => {
            if (!chunk) {
              return;
            }

            void chrome.tabs
              .sendMessage(tabId, { type: selectionStreamChunkType, payload: { requestId, content: chunk } })
              .catch(() => undefined);
          },
        )
      .then((reply) => ({ reply: reply.reply })),
      (response) => {
        sendResponse(response as SelectionRuntimeResponse);
      },
    );

    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isSelectionCancelMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId != null) {
      llmOrchestrator.cancel(tabId);
    }

    return undefined;
  });

  // Reuse the existing page-lifecycle port to ensure selection requests stop on navigation.
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
