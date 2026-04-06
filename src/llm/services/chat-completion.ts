import { getChatMessageTextContent, type ChatMessage, type ChatMessageContent } from '../../shared/types/chat';
import type { ModelSettings } from '../../shared/types/settings';
import type { ChatCompletionInput, ChatCompletionProvider, LlmChatMessage } from '../model/chat';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible-provider';
import {getDefaultToolRegistry, type ToolRegistry} from '../tools/tool-registry';
import { runToolCallOrchestrator } from './tool-call-orchestrator';

function toLlmMessages(settings: ModelSettings, history: ChatMessage[], input: ChatMessageContent): LlmChatMessage[] {
  const trimmedHistory = history.slice(-settings.maxHistory);
  const messages: LlmChatMessage[] = [];

  if (settings.systemPrompt.trim()) {
    messages.push({ role: 'system', content: settings.systemPrompt.trim() });
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

export async function completeChat(
  settings: ModelSettings,
  history: ChatMessage[],
  input: ChatMessageContent,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
  options?: {
    provider?: ChatCompletionProvider;
    toolRegistry?: ToolRegistry;
  },
): Promise<string> {
  const provider = options?.provider ?? new OpenAiCompatibleProvider(settings);
  const request: ChatCompletionInput = {
    model: settings.model,
    messages: toLlmMessages(settings, history, input),
  };

  return runToolCallOrchestrator(
    request,
    {
      provider,
      toolRegistry: options?.toolRegistry ?? getDefaultToolRegistry(),
    },
    onChunk,
    signal,
  );
}
