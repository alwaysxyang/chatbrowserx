import { ChatCompletionService } from '../../llm/services/chat-completion';
import type { InvokeContext } from '../../llm/tools/tool-registry';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';

export type LlmSessionScope = number | string;

interface LlmSession {
  requestId: number;
  controller: AbortController;
  onChunk?: (chunk: string) => void;
}

/**
 * Orchestrates LLM chat completion requests for background modules.
 *
 * - One in-flight request per scope.
 * - New requests cancel older ones for the same scope.
 * - Streaming callbacks are guarded to avoid stale chunks after replacement/cancel.
 */
export class LlmOrchestrator {
  private sessions = new Map<LlmSessionScope, LlmSession>();
  private nextRequestId = 1;

  /**
   * Runs a chat completion request for a scope and optionally streams chunks.
   *
   * @param context - Optional browser-agent context for request-scoped tools.
   * @param scope - The session scope making the request.
   * @param payload - Chat payload including history and input.
   * @param onChunk - Optional streaming callback for incremental output.
   * @returns The final reply text.
   */
  async complete(
    context: InvokeContext | undefined,
    scope: LlmSessionScope,
    payload: ChatRequestPayload,
    onChunk?: (chunk: string) => void,
  ): Promise<ChatResponsePayload> {
    this.cancel(scope);

    const requestId = this.nextRequestId++;
    const settings = await loadSettings();
    const controller = new AbortController();
    const service = new ChatCompletionService({
      settings: settings.model,
    });

    this.sessions.set(scope, { requestId, controller, onChunk });

    try {
      const reply = await service.complete(
        context,
        payload.history,
        payload.input,
        (chunk) => {
          const current = this.sessions.get(scope);
          if (current?.requestId !== requestId) return;
          current.onChunk?.(chunk);
        },
        controller.signal,
      );

      return { reply };
    } finally {
      const current = this.sessions.get(scope);
      if (current?.requestId === requestId) {
        this.sessions.delete(scope);
      }
    }
  }

  /**
   * Cancels the current in-flight request (if any) for a scope.
   *
   * @param scope - The session scope to cancel.
   */
  cancel(scope: LlmSessionScope): void {
    const session = this.sessions.get(scope);
    if (!session) return;

    session.controller.abort();
    this.sessions.delete(scope);
  }
}
