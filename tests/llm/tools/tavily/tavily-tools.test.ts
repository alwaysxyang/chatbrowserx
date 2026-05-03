import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveSettings, defaultSettings } from '../../../../src/shared/storage/settings-repository';
import { createTavilySearchTool } from '../../../../src/llm/tools/tavily/tavily-search-tool';
import { createTavilyExtractTool } from '../../../../src/llm/tools/tavily/tavily-extract-tool';
import { createTavilyCrawlTool } from '../../../../src/llm/tools/tavily/tavily-crawl-tool';

const originalFetch = globalThis.fetch;

/**
 * Replaces global fetch with a successful Tavily JSON response.
 *
 * @param body - Response body returned by the mocked request.
 * @returns The fetch mock for request assertions.
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

/**
 * Saves a model settings fixture with only the Tavily key changed.
 *
 * @param tavilyApiKey - The Tavily key to persist for the current test.
 */
async function saveTavilyKey(tavilyApiKey: string): Promise<void> {
  await saveSettings({
    model: {
      ...defaultSettings.model,
      tavilyApiKey,
    },
  });
}

describe('Tavily tools', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('hides search definitions when the Tavily key is missing', async () => {
    const tool = createTavilySearchTool();

    await expect(tool.definition()).resolves.toBeNull();
  });

  it('shows search definitions when the Tavily key is configured', async () => {
    const tool = createTavilySearchTool();

    await saveTavilyKey('tvly-visible');

    await expect(tool.definition()).resolves.toMatchObject({
      function: {
        name: 'tavily_search',
      },
    });
  });

  it('reloads settings inside search invoke and sends the latest Tavily key', async () => {
    const fetchMock = mockTavilyFetch({
      query: 'latest ai browser news',
      answer: 'summary',
      results: [],
    });

    await saveTavilyKey('tvly-old');

    const tool = createTavilySearchTool();

    await saveTavilyKey('tvly-new');

    await expect(
      tool.invoke({
        query: 'latest ai browser news',
        topic: 'news',
        maxResults: 3,
        searchDepth: 'advanced',
      }),
    ).resolves.toMatchObject({
      query: 'latest ai browser news',
      answer: 'summary',
      results: [],
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tavily.com/search');
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer tvly-new',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      query: 'latest ai browser news',
      topic: 'news',
      max_results: 3,
      search_depth: 'advanced',
      include_answer: 'advanced',
      include_images: false,
      include_raw_content: false,
    });
  });

  it('throws when Tavily search invoke runs without a configured key', async () => {
    const tool = createTavilySearchTool();

    await expect(tool.invoke({ query: 'missing key' })).rejects.toThrow('TAVILY_API_KEY_MISSING');
  });

  it('posts extract requests to the Tavily extract endpoint', async () => {
    const fetchMock = mockTavilyFetch({
      results: [
        {
          url: 'https://example.com',
          raw_content: 'Example content',
        },
      ],
    });

    await saveTavilyKey('tvly-extract');

    const tool = createTavilyExtractTool();

    await expect(tool.invoke({
      urls: ['https://example.com'],
      extractDepth: 'advanced',
      format: 'text',
    })).resolves.toMatchObject({
      results: [
        {
          url: 'https://example.com',
          raw_content: 'Example content',
        },
      ],
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tavily.com/extract');
    expect(JSON.parse(String(request.body))).toMatchObject({
      urls: ['https://example.com'],
      extract_depth: 'advanced',
      format: 'text',
      include_images: false,
    });
  });

  it('posts crawl requests to the Tavily crawl endpoint', async () => {
    const fetchMock = mockTavilyFetch({
      base_url: 'https://docs.example.com',
      results: [],
    });

    await saveTavilyKey('tvly-crawl');

    const tool = createTavilyCrawlTool();

    await expect(tool.invoke({
      url: 'https://docs.example.com',
      instructions: 'Only follow API reference pages.',
      maxDepth: 2,
      limit: 8,
      format: 'markdown',
    })).resolves.toMatchObject({
      base_url: 'https://docs.example.com',
      results: [],
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tavily.com/crawl');
    expect(JSON.parse(String(request.body))).toMatchObject({
      url: 'https://docs.example.com',
      instructions: 'Only follow API reference pages.',
      max_depth: 2,
      limit: 8,
      format: 'markdown',
      extract_depth: 'basic',
    });
  });
});
