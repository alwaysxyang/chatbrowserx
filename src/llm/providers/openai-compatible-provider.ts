import type { ChatCompletionInput } from '../model/chat';
import type { ModelSettings } from '../../shared/types/settings';

interface OpenAiCompatibleResponse {
  choices?: Array<{
    // 标准非流式响应
    message?: {
      content?: string;
    };
    // 流式响应中的增量片段
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export class OpenAiCompatibleProvider {
  constructor(private readonly settings: ModelSettings) {}

  async completeChat(input: ChatCompletionInput): Promise<string> {
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
        messages: input.messages,
        // 按照 chatplugins 的约定，使用流式响应，并显式关闭 thinking
        stream: true,
        thinking: false,
      }),
    });

    if (!response.ok) {
      const rawBody = await response.text();
      const data = rawBody ? this.parseResponse(rawBody) : undefined;
      // 保留后端返回的错误信息，否则用通用的英文前缀，UI 层可以按需要再二次翻译
      throw new Error(data?.error?.message || `REQUEST_FAILED: ${response.status}`);
    }

    if (!response.body) {
      return 'EMPTY_RESPONSE';
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let assistantContent = '';

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
          const delta = json?.choices?.[0]?.delta as { content?: string } | undefined;
          if (delta?.content) {
            assistantContent += delta.content;
          }
        } catch {
          // 流片段解析失败时忽略该片段，继续读取后续内容
        }
      }
    }

    return assistantContent.trim() || 'EMPTY_RESPONSE';
  }

  private parseResponse(rawBody: string): OpenAiCompatibleResponse | undefined {
    try {
      return JSON.parse(rawBody) as OpenAiCompatibleResponse;
    } catch {
      return undefined;
    }
  }
}
