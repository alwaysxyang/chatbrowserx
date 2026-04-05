import { describe, expect, it } from 'vitest';
import { OpenAiCompatibleProvider } from '../../../src/llm/providers/openai-compatible-provider';
import { defaultSettings } from '../../../src/shared/storage/settings-repository';

describe('OpenAiCompatibleProvider', () => {
  it('surfaces http failures even when the response is not json', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Bad gateway', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const provider = new OpenAiCompatibleProvider({
      ...defaultSettings.model,
      apiKey: 'k',
      model: 'm',
    });

    await expect(
      provider.completeChat({ model: 'm', messages: [{ role: 'user', content: 'hello' }] }),
    ).rejects.toThrow('请求失败: 502');

    globalThis.fetch = originalFetch;
  });
});
