import type {
  ChatCompletionInput,
  ChatCompletionProvider,
  ChatCompletionResult,
} from '../model/chat';
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
    if (!this.config.baseUrl || !input.model || !this.config.apiKey) {
      // 使用稳定的错误代码，具体文案在 UI 层结合当前语言决定
      throw new Error('MODEL_MISCONFIGURED');
    }

    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
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
      return {
        message: {
          role: 'assistant',
          content: '',
        },
      };
    }
    const assistantMessage = await readOpenAiCompatibleStream(response.body, onChunk);

    return {
      message: {
        role: 'assistant',
        content: assistantMessage.content,
        ...(assistantMessage.toolCalls?.length ? { toolCalls: assistantMessage.toolCalls } : {}),
      },
    };
  }
}
