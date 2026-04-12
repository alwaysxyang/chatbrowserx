import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, saveSettings } from '../../../../src/shared/storage/settings-repository';
import { invokeTavilyEndpoint } from '../../../../src/llm/tools/shared/tavily-request';

describe('invokeTavilyEndpoint', () => {
  it('loads the latest Tavily key and returns parsed JSON objects', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: 'summary',
          results: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await saveSettings({
      model: {
        ...defaultSettings.model,
        tavilyApiKey: 'tvly-shared',
      },
    });

    await expect(invokeTavilyEndpoint('/search', { query: 'hello' })).resolves.toMatchObject({
      answer: 'summary',
      results: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tvly-shared',
          'Content-Type': 'application/json',
        }),
      }),
    );

    globalThis.fetch = originalFetch;
  });
});
