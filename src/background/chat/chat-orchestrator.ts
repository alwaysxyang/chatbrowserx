import { ChatCompletionService } from '../../llm/services/chat-completion';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';
import { chatStreamChunkType } from '../../shared/types/chat';

interface ChatSession {
  service: ChatCompletionService;
  controller: AbortController;
}

/**
 * Orchestrates chat completion requests
 * Manages chat sessions per tab and handles streaming responses
 */
export class ChatOrchestrator {
  private sessions = new Map<number, ChatSession>();

  /**
   * Handles a chat completion request for the specified tab
   * @param tabId - The tab ID making the request
   * @param payload - The chat request payload
   * @returns The chat response
   */
  async complete(tabId: number, payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    if (this.sessions.has(tabId)) {
      throw new Error(`Chat request already in progress for tab ${tabId}`);
    }

    const settings = await loadSettings();
    const controller = new AbortController();
    const service = new ChatCompletionService({
      settings: settings.model,
    });
    this.sessions.set(tabId, { service, controller });

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
      this.sessions.delete(tabId);
    }
  }

  /**
   * Cancels an ongoing chat request for the specified tab
   * @param tabId - The tab ID to cancel
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
   * Handles streaming chunks by forwarding to the content script
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
