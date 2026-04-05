import type { ChatMessage } from '../../shared/types/chat';
import type { ChatSettings } from '../../shared/types/settings';
import type { ChatCompletionInput, LlmChatMessage } from '../model/chat';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible-provider';

function toLlmMessages(settings: ChatSettings, history: ChatMessage[], input: string): LlmChatMessage[] {
  const trimmedHistory = history.slice(-settings.maxHistory);
  const messages: LlmChatMessage[] = [];

  if (settings.systemPrompt.trim()) {
    messages.push({ role: 'system', content: settings.systemPrompt.trim() });
  }

  trimmedHistory.forEach((message) => {
    messages.push({ role: message.role, content: message.content });
  });

  messages.push({ role: 'user', content: input });

  return messages;
}

export async function completeChat(settings: ChatSettings, history: ChatMessage[], input: string): Promise<string> {
  const provider = new OpenAiCompatibleProvider(settings);
  const request: ChatCompletionInput = {
    model: settings.model,
    messages: toLlmMessages(settings, history, input),
  };

  return provider.completeChat(request);
}
