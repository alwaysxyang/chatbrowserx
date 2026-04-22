import { LlmOrchestrator } from '../llm/llm-orchestrator';
import { runtimeErrorResponse, toRuntimeResponse } from '../../shared/types/runtime-messages';
import { chatSessionPortName } from '../../shared/types/chat';
import type { SelectionResponsePayload, SelectionRuntimeResponse } from '../../shared/types/selection';
import {
  isSelectionCancelMessage,
  isSelectionRequestMessage,
  selectionStreamChunkType,
} from '../../shared/types/selection';

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

    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(runtimeErrorResponse('No tab ID'));
      return true;
    }

    const { requestId, prompt } = message.payload;

    void toRuntimeResponse<SelectionResponsePayload>(
      llmOrchestrator
        .complete(
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
    ).then((response) => {
      sendResponse(response satisfies SelectionRuntimeResponse);
    });

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

