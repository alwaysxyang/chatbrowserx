import { getChatMessageTextContent, type ChatMessage, type ChatMessageContent } from '../../shared/types/chat';
import { getActiveProviderModel, type ModelSettings } from '../../shared/types/settings';
import type { ChatCompletionInput, ChatCompletionProvider, LlmChatMessage } from '../model/chat';
import { OpenAiCompatibleProvider } from '../providers/openai/provider';
import { CodexProvider } from '../providers/codex/provider';
import { getDefaultToolRegistry } from '../tools/tool-registry';
import { runToolCallOrchestrator } from './tool-call-orchestrator';

export interface ChatCompletionServiceConfig {
  settings: ModelSettings;
}

export class ChatCompletionService {
  private config: ChatCompletionServiceConfig;
  private readonly provider: ChatCompletionProvider;

  constructor(config: ChatCompletionServiceConfig) {
    this.config = config;
    this.provider = this.createProvider(config.settings);
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
    });
  }

  private toLlmMessages(history: ChatMessage[], input: ChatMessageContent): LlmChatMessage[] {
    const trimmedHistory = history.slice(-this.config.settings.maxHistory);
    const messages: LlmChatMessage[] = [];

    if (this.config.settings.systemPrompt.trim()) {
      messages.push({ role: 'system', content: this.config.settings.systemPrompt.trim() });
    }

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

  async complete(
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
      request,
      {
        provider: this.provider,
        toolRegistry: getDefaultToolRegistry(),
      },
      onChunk,
      signal,
    );
  }
}
