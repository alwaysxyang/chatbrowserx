import { ChatCompletionService } from '../../llm/services/chat-completion';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';
import { chatStreamChunkType } from '../../shared/types/chat';

interface ChatSession {
  requestId: number;
  service: ChatCompletionService;
  controller: AbortController;
}

/**
 * Orchestrates LLM chat completion requests.
 *
 * Manages one in-flight chat request per tab and forwards streaming chunks to the content script.
 */
export class LlmOrchestrator {
  private sessions = new Map<number, ChatSession>();
  private nextRequestId = 1;

  /**
   * Handles a chat completion request for the specified tab.
   * If a previous request exists for the same tab, it will be cancelled before starting the new one.
   *
   * @param tabId - The tab ID making the request.
   * @param payload - The chat request payload.
   * @returns The chat response.
   */
  async complete(tabId: number, payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    // Enforce "single in-flight per tab": stop the previous request if any.
    this.cancel(tabId);

    const requestId = this.nextRequestId++;
    const settings = await loadSettings();
    const controller = new AbortController();
    const service = new ChatCompletionService({
      settings: settings.model,
    });
    this.sessions.set(tabId, { requestId, service, controller });

    try {
      const reply = await service.complete(
        payload.history,
        payload.input,
        (chunk) => {
          this.handleStreamChunk(tabId, chunk);
        },
        controller.signal,
      );

      return { reply };
    } finally {
      // Avoid deleting a newer session that may have replaced this request.
      const current = this.sessions.get(tabId);
      if (current?.requestId === requestId) {
        this.sessions.delete(tabId);
      }
    }
  }

  /**
   * Cancels an ongoing chat request for the specified tab.
   *
   * @param tabId - The tab ID to cancel.
   */
  cancel(tabId: number): void {
    const session = this.sessions.get(tabId);
    if (!session) {
      return;
    }

    session.controller.abort();
    this.sessions.delete(tabId);
  }

  /**
   * Handles streaming chunks by forwarding them to the content script.
   */
  private handleStreamChunk(tabId: number, chunk: string): void {
    if (!chunk) return;

    void chrome.tabs
      .sendMessage(tabId, {
        type: chatStreamChunkType,
        payload: { content: chunk },
      })
      .catch(() => undefined);
  }
}

