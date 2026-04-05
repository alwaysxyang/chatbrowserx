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
      throw new Error('请先在设置中填写 API Base URL、API Key 和 Model。');
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
      throw new Error(data?.error?.message || `请求失败: ${response.status}`);
    }

    return data?.choices?.[0]?.message?.content?.trim() || '模型返回了空响应。';
  }

  private parseResponse(rawBody: string): OpenAiCompatibleResponse | undefined {
    try {
      return JSON.parse(rawBody) as OpenAiCompatibleResponse;
    } catch {
      return undefined;
    }
  }
}
