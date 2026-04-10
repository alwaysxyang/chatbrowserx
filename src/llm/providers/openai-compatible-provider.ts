import type {
  ChatCompletionInput,
  ChatCompletionProvider,
  ChatCompletionResult,
} from '../model/chat';
import { buildAssistantMessageResult, getProviderEndpoint, throwIfProviderMisconfigured } from './provider-response';
import { readOpenAiCompatibleStream } from './openai-compatible-stream';
import {
  parseOpenAiCompatibleResponse,
  toOpenAiCompatibleWireMessage,
} from './openai-compatible-wire-format';

export interface OpenAiCompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
}

export class OpenAiCompatibleProvider implements ChatCompletionProvider {
  constructor(private readonly config: OpenAiCompatibleProviderConfig) {}

  async completeChat(
    input: ChatCompletionInput,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult> {
    throwIfProviderMisconfigured(this.config.baseUrl, input.model, this.config.apiKey);

    const response = await fetch(getProviderEndpoint(this.config.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map(toOpenAiCompatibleWireMessage),
        ...(input.tools?.length ? { tools: input.tools } : {}),
        // Use streaming responses and explicitly disable thinking,
        // following the chatplugins implementation.
        stream: true,
        thinking: { type: 'disabled' },
      }),
      signal,
    });

    if (!response.ok) {
      const rawBody = await response.text();
      const data = rawBody ? parseOpenAiCompatibleResponse(rawBody) : undefined;
      // 保留后端返回的错误信息，否则用通用的英文前缀，UI 层可以按需要再二次翻译
      throw new Error(data?.error?.message || `REQUEST_FAILED: ${response.status}`);
    }

    if (!response.body) {
      return buildAssistantMessageResult();
    }
    const assistantMessage = await readOpenAiCompatibleStream(response.body, onChunk);

    return buildAssistantMessageResult(assistantMessage);
  }
}
