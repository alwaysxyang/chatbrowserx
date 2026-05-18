import { getChatMessageTextContent, type ChatMessage, type ChatMessageContent } from '../../shared/types/chat';
import { getActiveProviderModel, type ModelSettings } from '../../shared/types/settings';
import type { ChatCompletionInput, ChatCompletionProvider, LlmChatMessage } from '../model/chat';
import { OpenAiCompatibleProvider } from '../providers/openai/provider';
import { CodexProvider } from '../providers/codex/provider';
import { getDefaultToolRegistry, type InvokeContext, type ToolRegistry } from '../tools/tool-registry';
import { buildBrowserAgentSystemPrompt } from './browser-agent-system-prompt';
import { runToolCallOrchestrator } from './tool-call-orchestrator';

export interface ChatCompletionServiceConfig {
  settings: ModelSettings;
  /** Tool registry used by the model tool loop. Defaults to the stable global registry. */
  toolRegistry?: ToolRegistry;
}

export class ChatCompletionService {
  private config: ChatCompletionServiceConfig;
  private readonly provider: ChatCompletionProvider;
  private readonly toolRegistry: ToolRegistry;

  constructor(config: ChatCompletionServiceConfig) {
    this.config = config;
    this.provider = this.createProvider(config.settings);
    this.toolRegistry = config.toolRegistry ?? getDefaultToolRegistry();
  }

  private createProvider(settings: ModelSettings): ChatCompletionProvider {
    if (settings.provider === 'openai') {
      return new OpenAiCompatibleProvider({
        baseUrl: settings.openai.baseUrl,
        apiKey: settings.openai.apiKey,
      });
    }
    return new CodexProvider({
      baseUrl: settings.codex.baseUrl,
      accessToken: settings.codex.accessToken,
      effort: settings.codex.effort,
    });
  }

  private toLlmMessages(history: ChatMessage[], input: ChatMessageContent): LlmChatMessage[] {
    const trimmedHistory = history.slice(-this.config.settings.maxHistory);
    const messages: LlmChatMessage[] = [
      { role: 'system', content: buildBrowserAgentSystemPrompt(this.config.settings.systemPrompt) },
    ];

    trimmedHistory.forEach((message) => {
      if (message.role === 'user') {
        messages.push({ role: 'user', content: getChatMessageTextContent(message.content) });
        return;
      }

      messages.push({ role: 'assistant', content: getChatMessageTextContent(message.content) });
    });

    messages.push({ role: 'user', content: input });

    return messages;
  }

  /**
   * Runs one chat completion request and passes request-scoped context to the tool loop.
   *
   * @param context - Request-scoped context for browser tools.
   * @param history - Prior chat messages included in the completion.
   * @param input - Current user input.
   * @param onChunk - Optional streaming callback.
   * @param signal - Optional abort signal.
   * @returns The final assistant reply.
   */
  async complete(
    context: InvokeContext | undefined,
    history: ChatMessage[],
    input: ChatMessageContent,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const request: ChatCompletionInput = {
      model: getActiveProviderModel(this.config.settings),
      messages: this.toLlmMessages(history, input),
    };

    return runToolCallOrchestrator(
      context,
      request,
      {
        provider: this.provider,
        toolRegistry: this.toolRegistry,
      },
      onChunk,
      signal,
    );
  }
}
