import { LlmOrchestrator } from '../llm/llm-orchestrator';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../shared/storage/chat-history-repository';
import {
  chatStateSyncType,
  chatStreamChunkType,
  getChatMessageTextContent,
  type ChatMessage,
  type ChatRequestPayload,
  type ChatResponsePayload,
  type ChatSessionState,
} from '../../shared/types/chat';
import { createSessionChatMessage } from './chat-session-message';
import { broadcastToContentTabs } from './chat-session-broadcaster';

const globalChatScope = 'global-chat';
const interruptedByBackgroundText = '后台会话已结束，当前请求已中断。';

type ChatLlmOrchestrator = Pick<LlmOrchestrator, 'complete' | 'cancel'>;

/**
 * Owns the profile-wide chat transcript and running request lifecycle.
 */
export class ChatSessionCoordinator {
  private messages: ChatMessage[] = [];
  private isHydrated = false;
  private hydratePromise: Promise<void> | null = null;
  private requestId: number | null = null;
  private activeAssistantMessageId: string | null = null;
  private nextRequestId = 1;
  private cancelRequested = false;
  private chunkQueue: Promise<void> = Promise.resolve();

  constructor(private readonly llmOrchestrator: ChatLlmOrchestrator = new LlmOrchestrator()) {}

  /**
   * Returns the current global chat state.
   *
   * @returns The current global chat state snapshot.
   */
  async getState(): Promise<ChatSessionState> {
    await this.hydrate();
    return this.buildState();
  }

  /**
   * Starts a new global chat request when no request is running.
   *
   * @param payload - The request input. History is owned by this coordinator.
   * @returns The final assistant reply.
   */
  async request(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    await this.hydrate();
    if (this.requestId !== null) {
      throw new Error('CHAT_SESSION_BUSY');
    }

    const currentRequestId = this.nextRequestId++;
    const userMessage = createSessionChatMessage('user', payload.input);
    const assistantMessage = createSessionChatMessage('assistant', '', 'streaming');
    const requestHistory = this.buildRequestHistory();

    this.messages = [...this.messages, userMessage, assistantMessage];
    this.requestId = currentRequestId;
    this.activeAssistantMessageId = assistantMessage.id;
    this.cancelRequested = false;
    this.chunkQueue = Promise.resolve();

    await this.persistAndBroadcastState();

    try {
      const response = await this.llmOrchestrator.complete(
        globalChatScope,
        { input: payload.input, history: requestHistory },
        (chunk) => {
          this.enqueueChunk(currentRequestId, assistantMessage.id, chunk);
        },
      );

      await this.drainChunkQueue();
      this.updateAssistantMessage(assistantMessage.id, {
        content: response.reply,
        status: 'completed',
        errorMessage: undefined,
      });
      return response;
    } catch (error) {
      await this.drainChunkQueue();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentAssistantMessage = this.messages.find((message) => message.id === assistantMessage.id);
      const streamedContent = currentAssistantMessage == null
        ? ''
        : getChatMessageTextContent(currentAssistantMessage.content);
      this.updateAssistantMessage(assistantMessage.id, {
        status: this.cancelRequested ? 'interrupted' : 'error',
        errorMessage,
        content: streamedContent || errorMessage,
      });
      throw error;
    } finally {
      if (this.requestId === currentRequestId) {
        this.requestId = null;
        this.activeAssistantMessageId = null;
        this.cancelRequested = false;
      }
      await this.persistAndBroadcastState();
    }
  }

  /**
   * Cancels the currently running global chat request.
   */
  async cancel(): Promise<void> {
    this.cancelRequested = true;
    this.llmOrchestrator.cancel(globalChatScope);
  }

  /**
   * Clears the global chat state when no request is running.
   */
  async clear(): Promise<void> {
    await this.hydrate();
    if (this.requestId !== null) {
      throw new Error('CHAT_SESSION_BUSY');
    }

    this.messages = [];
    await clearChatHistory();
    await this.broadcastState();
  }

  /**
   * Hydrates global chat history exactly once per background lifetime.
   */
  private async hydrate(): Promise<void> {
    if (this.isHydrated) {
      return;
    }

    this.hydratePromise ??= loadChatHistory().then(async (history) => {
      let hasStaleStreamingMessage = false;
      this.messages = history.map((message) => {
        if (message.role === 'assistant' && message.status === 'streaming') {
          hasStaleStreamingMessage = true;
          return {
            ...message,
            status: 'error',
            errorMessage: interruptedByBackgroundText,
            content: getChatMessageTextContent(message.content) || interruptedByBackgroundText,
          };
        }

        return message;
      });
      this.isHydrated = true;
      if (hasStaleStreamingMessage) {
        await saveChatHistory(this.messages);
      }
    });

    await this.hydratePromise;
  }

  /**
   * Builds the LLM request history from completed global transcript state.
   */
  private buildRequestHistory(): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (let index = 0; index < this.messages.length; index += 1) {
      const message = this.messages[index];

      if (message.role === 'assistant') {
        if (message.status == null || message.status === 'completed') {
          result.push({
            ...message,
            content: getChatMessageTextContent(message.content),
          });
        }
        continue;
      }

      const nextMessage = this.messages[index + 1];
      if (nextMessage?.role === 'assistant' && nextMessage.status != null && nextMessage.status !== 'completed') {
        continue;
      }

      result.push({
        ...message,
        content: getChatMessageTextContent(message.content),
      });
    }

    return result;
  }

  /**
   * Builds the serializable global chat session state.
   */
  private buildState(): ChatSessionState {
    return {
      messages: this.messages,
      isRunning: this.requestId !== null,
      requestId: this.requestId,
      activeAssistantMessageId: this.activeAssistantMessageId,
    };
  }

  /**
   * Patches a background-owned assistant message by id.
   *
   * @param id - Assistant message id.
   * @param patch - Message fields to replace.
   */
  private updateAssistantMessage(id: string, patch: Partial<ChatMessage>): void {
    this.messages = this.messages.map((message) => (
      message.id === id ? { ...message, ...patch } : message
    ));
  }

  /**
   * Queues a streaming chunk so persistence and broadcasts keep their original order.
   *
   * @param requestId - Active request id.
   * @param messageId - Active assistant message id.
   * @param chunk - Incremental assistant content.
   */
  private enqueueChunk(requestId: number, messageId: string, chunk: string): void {
    this.chunkQueue = this.chunkQueue
      .then(() => this.acceptChunk(requestId, messageId, chunk))
      .catch((error) => {
        console.error('[ChatBrowserX] Failed to process chat stream chunk:', error);
      });
  }

  /**
   * Waits for all queued streaming chunk side effects to settle.
   */
  private async drainChunkQueue(): Promise<void> {
    await this.chunkQueue;
  }

  /**
   * Accepts a streaming chunk for the active request and broadcasts it.
   *
   * @param requestId - Active request id.
   * @param messageId - Active assistant message id.
   * @param chunk - Incremental assistant content.
   */
  private async acceptChunk(requestId: number, messageId: string, chunk: string): Promise<void> {
    if (!chunk || this.requestId !== requestId || this.activeAssistantMessageId !== messageId) {
      return;
    }

    this.messages = this.messages.map((message) => (
      message.id === messageId
        ? { ...message, content: getChatMessageTextContent(message.content) + chunk }
        : message
    ));
    await saveChatHistory(this.messages);
    await broadcastToContentTabs({
      type: chatStreamChunkType,
      payload: { requestId, messageId, content: chunk },
    });
  }

  /**
   * Persists the transcript and broadcasts the full state.
   */
  private async persistAndBroadcastState(): Promise<void> {
    await saveChatHistory(this.messages);
    await this.broadcastState();
  }

  /**
   * Broadcasts the full state to all content tabs.
   */
  private async broadcastState(): Promise<void> {
    await broadcastToContentTabs({
      type: chatStateSyncType,
      payload: this.buildState(),
    });
  }
}
