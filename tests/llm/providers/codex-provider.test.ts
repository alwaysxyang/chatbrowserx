import { describe, expect, it, vi } from 'vitest';
import { CodexProvider } from '../../../src/llm/providers/codex/provider';
import type { ToolDefinition } from '../../../src/llm/tools/tool-registry';

describe('CodexProvider', () => {
  it('throws MODEL_MISCONFIGURED when config is incomplete', async () => {
    const provider = new CodexProvider({ baseUrl: '', accessToken: '' });

    await expect(
      provider.completeChat({ model: 'm', messages: [] }, undefined, undefined),
    ).rejects.toThrow('MODEL_MISCONFIGURED');
  });

  it('sends a POST request to /codex/responses with Responses-compatible body and parses streamed text deltas', async () => {
    const originalFetch = globalThis.fetch;
    const streamBody = [
      'event: response.output_text.delta',
      'data: {"delta":"hello"}',
      '',
      'event: response.output_text.delta',
      'data: {"delta":" world"}',
      '',
      'data: [DONE]',
    ].join('\n');
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(streamBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const provider = new CodexProvider({ baseUrl: 'https://api.example.com', accessToken: 'token' });

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

    const onChunk = vi.fn();

    const result = await provider.completeChat(
      {
        model: 'm',
        messages: [
          { role: 'system', content: 'You are Codex.' },
          { role: 'user', content: 'Say hi' },
        ],
        tools,
      },
      onChunk,
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/codex/responses');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    });

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: 'm',
      stream: true,
      store: false,
    });
    expect(body.instructions).toBe('You are Codex.');
    expect(Array.isArray(body.input)).toBe(true);
    expect(body.input[0]).toMatchObject({ role: 'user' });

    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools[0]).toMatchObject({
      type: 'function',
      name: 'get_page_summary',
      description: 'Gets the current page summary.',
    });
    expect(body.tools[0].parameters).toEqual(tools[0].function.parameters);

    // 文本增量拼接
    expect(result).toEqual({
      message: {
        role: 'assistant',
        content: 'hello world',
      },
    });

    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(onChunk).toHaveBeenCalledWith(' world');

    globalThis.fetch = originalFetch;
  });

  it('aggregates documented function call events into LlmToolCall list', async () => {
    const originalFetch = globalThis.fetch;
    const streamBody = [
      'event: response.function_call_arguments.delta',
      'data: {"item_id":"fc_1","output_index":0,"delta":"{\\"url\\":\\"https://example.com\\"}"}',
      '',
      'event: response.output_item.done',
      'data: {"item":{"id":"fc_1","type":"function_call","name":"get_page_summary","call_id":"call_1","arguments":"{\\"url\\":\\"https://example.com\\"}"}}',
      '',
      'data: [DONE]',
    ].join('\n');

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(streamBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const provider = new CodexProvider({ baseUrl: 'https://api.example.com', accessToken: 'token' });

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

    const result = await provider.completeChat({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      tools,
    });

    expect(result.message.toolCalls).toBeDefined();
    expect(result.message.toolCalls?.length).toBe(1);
    const toolCall = result.message.toolCalls?.[0]!;
    expect(toolCall.id).toBe('call_1');
    expect(toolCall.type).toBe('function');
    expect(toolCall.function.name).toBe('get_page_summary');
    expect(toolCall.function.arguments).toBe('{"url":"https://example.com"}');

    globalThis.fetch = originalFetch;
  });

  it('serializes tool loop messages with Responses function_call items and parses standard SSE events', async () => {
    const originalFetch = globalThis.fetch;
    const streamBody = [
      'event: response.output_text.delta',
      'data: {"delta":"hello"}',
      '',
      'event: response.function_call_arguments.delta',
      'data: {"item_id":"fc_1","output_index":0,"delta":"{\\"url\\":\\"https://example.com\\"}"}',
      '',
      'event: response.output_item.done',
      'data: {"item":{"id":"fc_1","type":"function_call","name":"get_page_summary","call_id":"call_1","arguments":"{\\"url\\":\\"https://example.com\\"}"}}',
      '',
      'event: response.completed',
      'data: {"response":{"status":"completed"}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(streamBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    ) as unknown as typeof globalThis.fetch;

    const provider = new CodexProvider({ baseUrl: 'https://api.example.com', accessToken: 'token' });
    const onChunk = vi.fn();

    const result = await provider.completeChat(
      {
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
      },
      onChunk,
    );

    const request = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      input: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '',
            },
          ],
        },
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'get_page_summary',
          arguments: '{"url":"https://example.com"}',
        },
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: '{"summary":"example"}',
        },
      ],
    });

    expect(result).toEqual({
      message: {
        role: 'assistant',
        content: 'hello',
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
    expect(onChunk).toHaveBeenCalledWith('hello');

    globalThis.fetch = originalFetch;
  });

  it('surface http failures with response body or status code', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Bad gateway', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const provider = new CodexProvider({ baseUrl: 'https://api.example.com', accessToken: 'token' });

    await expect(
      provider.completeChat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('Bad gateway');

    globalThis.fetch = originalFetch;
  });

  it('throws when the Responses stream emits response.failed', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        [
          'event: response.failed',
          'data: {"error":{"message":"stream failed"}}',
        ].join('\n'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    ) as unknown as typeof globalThis.fetch;

    const provider = new CodexProvider({ baseUrl: 'https://api.example.com', accessToken: 'token' });

    await expect(
      provider.completeChat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('stream failed');

    globalThis.fetch = originalFetch;
  });

  it('ignores undocumented legacy tool call delta events', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        [
          'data: {"type":"response.output_tool_call_arguments.delta","output_tool_call_arguments":{"index":0,"delta":{"tool_call_id":"call_1","arguments":"{\\"url\\":\\"https://example.com\\"}"}}}',
          'data: [DONE]',
        ].join('\n'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    ) as unknown as typeof globalThis.fetch;

    const provider = new CodexProvider({ baseUrl: 'https://api.example.com', accessToken: 'token' });

    const result = await provider.completeChat({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
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
      ],
    });

    expect(result.message.toolCalls).toBeUndefined();

    globalThis.fetch = originalFetch;
  });
});
