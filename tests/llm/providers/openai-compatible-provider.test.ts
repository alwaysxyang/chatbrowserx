import { describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from '../../../src/llm/providers/openai-compatible-provider';
import { defaultSettings } from '../../../src/shared/storage/settings-repository';
import type { ToolDefinition } from '../../../src/llm/tools/tool-registry';

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
    ).rejects.toThrow('REQUEST_FAILED: 502');

    globalThis.fetch = originalFetch;
  });

  it('sends registered tools and parses streamed tool call deltas', async () => {
    const originalFetch = globalThis.fetch;
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

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(streamBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const provider = new OpenAiCompatibleProvider({
      ...defaultSettings.model,
      apiKey: 'k',
      model: 'm',
    });

    const result = await provider.completeChat({
      model: 'm',
      messages: [{ role: 'user', content: 'hello' }],
      tools,
    }, onChunk);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const request = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
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

    globalThis.fetch = originalFetch;
  });

  it('serializes tool loop messages to the OpenAI-compatible wire format', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"done"}}]}\ndata: [DONE]\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const provider = new OpenAiCompatibleProvider({
      ...defaultSettings.model,
      apiKey: 'k',
      model: 'm',
    });

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

    const request = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
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

    globalThis.fetch = originalFetch;
  });

  it('serializes mixed text and image user content parts', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"done"}}]}\ndata: [DONE]\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const provider = new OpenAiCompatibleProvider({
      ...defaultSettings.model,
      apiKey: 'k',
      model: 'm',
    });

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

    const request = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
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

    globalThis.fetch = originalFetch;
  });
});
