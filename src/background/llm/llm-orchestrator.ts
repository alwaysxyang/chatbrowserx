import { ChatCompletionService } from '../../llm/services/chat-completion';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';

interface TabSession {
  requestId: number;
  controller: AbortController;
  onChunk?: (chunk: string) => void;
}

/**
 * Orchestrates LLM chat completion requests for background modules.
 *
 * - One in-flight request per tab.
 * - New requests cancel older ones for the same tab.
 * - Streaming callbacks are guarded to avoid stale chunks after replacement/cancel.
 */
export class LlmOrchestrator {
  private sessions = new Map<number, TabSession>();
  private nextRequestId = 1;

  /**
   * Runs a chat completion request for a tab and optionally streams chunks.
   *
   * @param tabId - The tab ID making the request.
   * @param payload - Chat payload including history and input.
   * @param onChunk - Optional streaming callback for incremental output.
   * @returns The final reply text.
   */
  async complete(tabId: number, payload: ChatRequestPayload, onChunk?: (chunk: string) => void): Promise<ChatResponsePayload> {
    // Enforce "single in-flight per tab": stop the previous request if any.
    this.cancel(tabId);

    const requestId = this.nextRequestId++;
    const settings = await loadSettings();
    const controller = new AbortController();
    const service = new ChatCompletionService({ settings: settings.model });

    this.sessions.set(tabId, { requestId, controller, onChunk });

    try {
      const reply = await service.complete(
        payload.history,
        payload.input,
        (chunk) => {
          const current = this.sessions.get(tabId);
          if (current?.requestId !== requestId) return;
          current.onChunk?.(chunk);
        },
        controller.signal,
      );

      return { reply };
    } finally {
      const current = this.sessions.get(tabId);
      if (current?.requestId === requestId) {
        this.sessions.delete(tabId);
      }
    }
  }

  /**
   * Cancels the current in-flight request (if any) for a tab.
   *
   * @param tabId - The tab ID to cancel.
   */
  cancel(tabId: number): void {
    const session = this.sessions.get(tabId);
    if (!session) return;

    session.controller.abort();
    this.sessions.delete(tabId);
  }
}
