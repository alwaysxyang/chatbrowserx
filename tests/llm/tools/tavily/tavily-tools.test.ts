import { describe, expect, it, vi } from 'vitest';
import { saveSettings, defaultSettings } from '../../../../src/shared/storage/settings-repository';
import { createTavilySearchTool } from '../../../../src/llm/tools/tavily/tavily-search-tool';
import { createTavilyExtractTool } from '../../../../src/llm/tools/tavily/tavily-extract-tool';
import { createTavilyCrawlTool } from '../../../../src/llm/tools/tavily/tavily-crawl-tool';

describe('Tavily tools', () => {
  it('hides search definitions when the Tavily key is missing', async () => {
    const tool = createTavilySearchTool();

    await expect(tool.definition()).resolves.toBeNull();
  });

  it('shows search definitions when the Tavily key is configured', async () => {
    const tool = createTavilySearchTool();

    await saveSettings({
      model: {
        ...defaultSettings.model,
        tavilyApiKey: 'tvly-visible',
      },
    });

    await expect(tool.definition()).resolves.toMatchObject({
      function: {
        name: 'tavily_search',
      },
    });
  });

  it('reloads settings inside search invoke and sends the latest Tavily key', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: 'latest ai browser news',
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
        tavilyApiKey: 'tvly-old',
      },
    });

    const tool = createTavilySearchTool();

    await saveSettings({
      model: {
        ...defaultSettings.model,
        tavilyApiKey: 'tvly-new',
      },
    });

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

    globalThis.fetch = originalFetch;
  });

  it('throws when Tavily search invoke runs without a configured key', async () => {
    const tool = createTavilySearchTool();

    await expect(tool.invoke({ query: 'missing key' })).rejects.toThrow('TAVILY_API_KEY_MISSING');
  });

  it('posts extract requests to the Tavily extract endpoint', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              url: 'https://example.com',
              raw_content: 'Example content',
            },
          ],
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
        tavilyApiKey: 'tvly-extract',
      },
    });

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

    globalThis.fetch = originalFetch;
  });

  it('posts crawl requests to the Tavily crawl endpoint', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          base_url: 'https://docs.example.com',
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
        tavilyApiKey: 'tvly-crawl',
      },
    });

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

    globalThis.fetch = originalFetch;
  });
});
