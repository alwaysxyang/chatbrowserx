import type {
  ChatCompletionInput,
  ChatCompletionProvider,
  ChatCompletionResult,
  LlmChatMessage,
  LlmToolCall,
} from '../model/chat';
import type { ChatContentPart } from '../../shared/types/chat';
import type { ModelSettings } from '../../shared/types/settings';

interface OpenAiCompatibleResponse {
  choices?: Array<{
    // 流式响应中的增量片段
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function toWireMessage(message: LlmChatMessage): Record<string, unknown> {
  if (message.role === 'user') {
    return {
      role: 'user',
      content: toWireUserContent(message.content),
    };
  }

  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: toolCall.type,
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            })),
          }
        : {}),
    };
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

function toWireUserContent(content: string | ChatContentPart[]): string | ChatContentPart[] {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((part) => {
    if (part.type === 'text') {
      return {
        type: 'text' as const,
        text: part.text,
      };
    }

    return {
      type: 'image_url' as const,
      image_url: {
        url: part.image_url.url,
      },
    };
  });
}

export class OpenAiCompatibleProvider implements ChatCompletionProvider {
  constructor(private readonly settings: ModelSettings) {}

  async completeChat(
    input: ChatCompletionInput,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult> {
    if (!this.settings.baseUrl || !this.settings.model || !this.settings.apiKey) {
      // 使用稳定的错误代码，具体文案在 UI 层结合当前语言决定
      throw new Error('MODEL_MISCONFIGURED');
    }

    const response = await fetch(`${this.settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map(toWireMessage),
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
      const data = rawBody ? this.parseResponse(rawBody) : undefined;
      // 保留后端返回的错误信息，否则用通用的英文前缀，UI 层可以按需要再二次翻译
      throw new Error(data?.error?.message || `REQUEST_FAILED: ${response.status}`);
    }

    if (!response.body) {
      return {
        message: {
          role: 'assistant',
          content: 'EMPTY_RESPONSE',
        },
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let assistantContent = '';
    const streamedToolCalls = new Map<number, LlmToolCall>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.substring(6);
        try {
          const json = this.parseResponse(jsonStr);
          const choice = json?.choices?.[0];
          const delta = choice?.delta as
            | {
                content?: string;
                tool_calls?: Array<{
                  index?: number;
                  id?: string;
                  type?: 'function';
                  function?: {
                    name?: string;
                    arguments?: string;
                  };
                }>;
              }
            | undefined;

          if (delta?.content) {
            assistantContent += delta.content;
            onChunk?.(delta.content);
          }

          delta?.tool_calls?.forEach((toolCallDelta) => {
            const index = toolCallDelta.index ?? streamedToolCalls.size;
            const current = streamedToolCalls.get(index) ?? {
              id: toolCallDelta.id ?? `tool_call_${index}`,
              type: 'function',
              function: {
                name: '',
                arguments: '',
              },
            };

            streamedToolCalls.set(index, {
              id: toolCallDelta.id ?? current.id,
              type: 'function',
              function: {
                name: toolCallDelta.function?.name ?? current.function.name,
                arguments: `${current.function.arguments}${toolCallDelta.function?.arguments ?? ''}`,
              },
            });
          });

        } catch {
          // 流片段解析失败时忽略该片段，继续读取后续内容
        }
      }
    }

    const toolCalls = Array.from(streamedToolCalls.entries())
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .map(([, toolCall]) => toolCall)
      .filter((toolCall) => toolCall.function.name);

    return {
      message: {
        role: 'assistant',
        content: assistantContent.trim() || 'EMPTY_RESPONSE',
        ...(toolCalls.length ? { toolCalls } : {}),
      },
    };
  }

  private parseResponse(rawBody: string): OpenAiCompatibleResponse | undefined {
    try {
      return JSON.parse(rawBody) as OpenAiCompatibleResponse;
    } catch {
      return undefined;
    }
  }
}
