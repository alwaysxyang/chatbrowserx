import type { ChatCompletionInput } from '../model/chat';
import { getToolDefinitions } from '../tools/tool-registry';
import type { ModelSettings } from '../../shared/types/settings';

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
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
        tools: getToolDefinitions(),
      }),
    });

    const rawBody = await response.text();
    const data = rawBody ? this.parseResponse(rawBody) : undefined;

    if (!response.ok) {
      // 保留后端返回的错误信息，否则用通用的英文前缀，UI 层可以按需要再二次翻译
      throw new Error(data?.error?.message || `REQUEST_FAILED: ${response.status}`);
    }

    return data?.choices?.[0]?.message?.content?.trim() || 'EMPTY_RESPONSE';
  }

  private parseResponse(rawBody: string): OpenAiCompatibleResponse | undefined {
    try {
      return JSON.parse(rawBody) as OpenAiCompatibleResponse;
    } catch {
      return undefined;
    }
  }
}
