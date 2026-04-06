import { completeChat } from '../../llm/services/chat-completion';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';
import { chatStreamChunkType } from '../../shared/types/runtime-messages';

const controllers = new Map<number, AbortController>();

export async function handleChatRequest(
  payload: ChatRequestPayload,
  tabId?: number,
): Promise<ChatResponsePayload> {
  const settings = await loadSettings();
  const controller = new AbortController();

  if (tabId != null) {
    controllers.set(tabId, controller);
  }

  try {
    const reply = await completeChat(
      settings.model,
      payload.history,
      payload.input,
      (chunk) => {
        if (tabId == null || !chunk) return;

        void chrome.tabs
          .sendMessage(tabId as number, {
            type: chatStreamChunkType,
            payload: { content: chunk },
          })
          .catch(() => undefined);
      },
      controller.signal,
    );

    return { reply };
  } finally {
    if (tabId != null) {
      controllers.delete(tabId);
    }
  }
}

export function cancelChatRequest(tabId: number): void {
  const controller = controllers.get(tabId);
  if (controller) {
    controller.abort();
    controllers.delete(tabId);
  }
}
