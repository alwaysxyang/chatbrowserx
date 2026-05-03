import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from '../../../src/llm/providers/openai/provider';
import { defaultSettings } from '../../../src/shared/storage/settings-repository';
import type { ToolDefinition } from '../../../src/llm/tools/tool-registry';

const originalFetch = globalThis.fetch;

/**
 * Replaces global fetch with a mocked response.
 *
 * @param body - Response body.
 * @param options - Optional response init.
 * @returns The fetch mock.
 */
function mockFetchResponse(body: BodyInit, options: ResponseInit = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      ...options,
    }),
  );
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  return fetchMock;
}

/**
 * Creates the default OpenAI-compatible provider used by these tests.
 *
 * @returns Test provider instance.
 */
function createProvider(): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    baseUrl: defaultSettings.model.openai.baseUrl,
    apiKey: 'k',
  });
}

describe('OpenAiCompatibleProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('surfaces http failures even when the response is not json', async () => {
    mockFetchResponse('Bad gateway', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });

    const provider = createProvider();

    await expect(
      provider.completeChat({ model: 'm', messages: [{ role: 'user', content: 'hello' }] }),
    ).rejects.toThrow('REQUEST_FAILED: 502');
  });

  it('sends registered tools and parses streamed tool call deltas', async () => {
    const onChunk = vi.fn();
    const streamBody = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_page_summary","arguments":"{\\"url\\":\\"https://example.com\\"}"}}]}}]}\n',
      'data: {"choices":[{"delta":{"content":"Final answer"}}]}\n',
      'data: [DONE]\n',
    ].join('');
    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'get_page_summary',
          description: 'Gets the current page summary.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
            required: ['url'],
          },
        },
      },
    ];

    const fetchMock = mockFetchResponse(streamBody);
    const provider = createProvider();

    const result = await provider.completeChat({
      model: 'm',
      messages: [{ role: 'user', content: 'hello' }],
      tools,
    }, onChunk);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: 'm',
      tools,
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    });
    expect(result).toEqual({
      message: {
        role: 'assistant',
        content: 'Final answer',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_page_summary',
              arguments: '{"url":"https://example.com"}',
            },
          },
        ],
      },
    });
    expect(onChunk).toHaveBeenCalledWith('Final answer');

  });

  it('serializes tool loop messages to the OpenAI-compatible wire format', async () => {
    const fetchMock = mockFetchResponse('data: {"choices":[{"delta":{"content":"done"}}]}\ndata: [DONE]\n');
    const provider = createProvider();

    await provider.completeChat({
      model: 'm',
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_page_summary',
                arguments: '{"url":"https://example.com"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          toolCallId: 'call_1',
          name: 'get_page_summary',
          content: '{"summary":"example"}',
        },
      ],
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      messages: [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_page_summary',
                arguments: '{"url":"https://example.com"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: '{"summary":"example"}',
        },
      ],
    });

    expect(JSON.parse(String(request.body)).messages[0].toolCalls).toBeUndefined();
    expect(JSON.parse(String(request.body)).messages[1].toolCallId).toBeUndefined();
  });

  it('serializes mixed text and image user content parts', async () => {
    const fetchMock = mockFetchResponse('data: {"choices":[{"delta":{"content":"done"}}]}\ndata: [DONE]\n');
    const provider = createProvider();

    await provider.completeChat({
      model: 'm',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这两张图片' },
            { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
          ],
        },
      ],
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这两张图片' },
            { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
          ],
        },
      ],
    });
  });
});
