import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexProvider } from '../../../src/llm/providers/codex/provider';
import type { ToolDefinition } from '../../../src/llm/tools/tool-registry';

const originalFetch = globalThis.fetch;

/**
 * Creates a Codex provider with the shared valid test configuration.
 */
function createProvider(effort: 'high' | 'xhigh' = 'high'): CodexProvider {
  return new CodexProvider({
    baseUrl: 'https://api.example.com',
    accessToken: 'token',
    effort,
  });
}

/**
 * Installs a mocked streaming fetch response and returns the mock for assertions.
 */
function mockCodexFetch(body: BodyInit, options: ResponseInit = {}): ReturnType<typeof vi.fn> {
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
 * Builds the shared page summary tool fixture.
 */
function createPageSummaryTool(): ToolDefinition {
  return {
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
  };
}

describe('CodexProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws MODEL_MISCONFIGURED when config is incomplete', async () => {
    const provider = new CodexProvider({ baseUrl: '', accessToken: '', effort: 'high' });

    await expect(
      provider.completeChat({ model: 'm', messages: [] }, undefined, undefined),
    ).rejects.toThrow('MODEL_MISCONFIGURED');
  });

  it('sends Codex reasoning effort as Responses reasoning.effort', async () => {
    const mockFetch = mockCodexFetch('data: [DONE]');
    const provider = createProvider('xhigh');

    await provider.completeChat({
      model: 'm',
      messages: [{ role: 'user', content: 'think hard' }],
    });

    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;

    expect(JSON.parse(String(request.body))).toMatchObject({
      reasoning: {
        effort: 'xhigh',
      },
    });
  });

  it('sends a POST request to /codex/responses with Responses-compatible body and parses streamed text deltas', async () => {
    const streamBody = [
      'event: response.output_text.delta',
      'data: {"delta":"hello"}',
      '',
      'event: response.output_text.delta',
      'data: {"delta":" world"}',
      '',
      'data: [DONE]',
    ].join('\n');
    const mockFetch = mockCodexFetch(streamBody);
    const provider = createProvider();
    const tools = [createPageSummaryTool()];

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

    expect(result).toEqual({
      message: {
        role: 'assistant',
        content: 'hello world',
      },
    });

    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(onChunk).toHaveBeenCalledWith(' world');
  });

  it('aggregates documented function call events into LlmToolCall list', async () => {
    const streamBody = [
      'event: response.function_call_arguments.delta',
      'data: {"item_id":"fc_1","output_index":0,"delta":"{\\"url\\":\\"https://example.com\\"}"}',
      '',
      'event: response.output_item.done',
      'data: {"item":{"id":"fc_1","type":"function_call","name":"get_page_summary","call_id":"call_1","arguments":"{\\"url\\":\\"https://example.com\\"}"}}',
      '',
      'data: [DONE]',
    ].join('\n');
    mockCodexFetch(streamBody);
    const provider = createProvider();
    const tools = [createPageSummaryTool()];

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
  });

  it('serializes tool loop messages with Responses function_call items and parses standard SSE events', async () => {
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
    const fetchMock = mockCodexFetch(streamBody);
    const provider = createProvider();
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

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
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
  });

  it('surface http failures with response body or status code', async () => {
    mockCodexFetch('Bad gateway', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });
    const provider = createProvider();

    await expect(
      provider.completeChat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('Bad gateway');
  });

  it('throws when the Responses stream emits response.failed', async () => {
    mockCodexFetch([
      'event: response.failed',
      'data: {"error":{"message":"stream failed"}}',
    ].join('\n'));
    const provider = createProvider();

    await expect(
      provider.completeChat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('stream failed');
  });

  it('ignores undocumented legacy tool call delta events', async () => {
    mockCodexFetch([
      'data: {"type":"response.output_tool_call_arguments.delta","output_tool_call_arguments":{"index":0,"delta":{"tool_call_id":"call_1","arguments":"{\\"url\\":\\"https://example.com\\"}"}}}',
      'data: [DONE]',
    ].join('\n'));
    const provider = createProvider();

    const result = await provider.completeChat({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [createPageSummaryTool()],
    });

    expect(result.message.toolCalls).toBeUndefined();
  });
});
