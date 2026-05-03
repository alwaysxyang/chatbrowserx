import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, saveSettings } from '../../../../src/shared/storage/settings-repository';
import { invokeTavilyEndpoint } from '../../../../src/llm/tools/tavily/tavily-request';

const originalFetch = globalThis.fetch;

/**
 * Installs a mocked Tavily fetch response and returns the mock for request assertions.
 */
function mockTavilyFetch(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

  return fetchMock;
}

describe('invokeTavilyEndpoint', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads the latest Tavily key and returns parsed JSON objects', async () => {
    const fetchMock = mockTavilyFetch({
      answer: 'summary',
      results: [],
    });

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
  });
});
