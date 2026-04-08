import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../../src/shared/storage/settings-repository';
import { completeChat } from '../../../src/llm/services/chat-completion';
import { createToolRegistry, type LlmToolModule } from '../../../src/llm/tools/tool-registry';
import type {
  ChatCompletionProvider,
  ChatCompletionResult,
  ChatCompletionInput,
  LlmAssistantMessage,
} from '../../../src/llm/model/chat';

describe('completeChat', () => {
  it('executes requested tools and continues until it receives a final assistant reply', async () => {
    const provider = {
      completeChat: vi
        .fn<ChatCompletionProvider['completeChat']>()
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'tool-call-1',
                type: 'function',
                function: {
                  name: 'get_page_summary',
                  arguments: '{"url":"https://example.com"}',
                },
              },
            ],
          } satisfies LlmAssistantMessage,
        } satisfies ChatCompletionResult)
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: 'The page is about testing.',
          } satisfies LlmAssistantMessage,
        } satisfies ChatCompletionResult),
    } satisfies ChatCompletionProvider;

    const tool = {
      name: () => 'get_page_summary',
      definition: () => ({
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
      }),
      invoke: vi.fn(async ({ url }) => JSON.stringify({ url, summary: 'Testing page summary' })),
    } satisfies LlmToolModule;

    const reply = await completeChat(
      {
        ...defaultSettings.model,
        provider: 'openai',
        model: 'gpt-test',
        openai: {
          ...defaultSettings.model.openai,
          apiKey: 'key',
          model: 'gpt-test',
        },
      },
      [{ id: '1', role: 'assistant', content: 'Old answer' }],
      'Summarize the page',
      undefined,
      undefined,
      {
        provider,
        toolRegistry: (() => {
          const registry = createToolRegistry();
          registry.addTool(tool);
          return registry;
        })(),
      },
    );

    expect(reply).toBe('The page is about testing.');
    expect(tool.invoke).toHaveBeenCalledWith({ url: 'https://example.com' });
    expect(provider.completeChat).toHaveBeenCalledTimes(2);

    const secondCallInput = provider.completeChat.mock.calls[1]?.[0];
    expect(secondCallInput?.messages).toContainEqual({
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'tool-call-1',
          type: 'function',
          function: {
            name: 'get_page_summary',
            arguments: '{"url":"https://example.com"}',
          },
        },
      ],
    });
    expect(secondCallInput?.messages).toContainEqual({
      role: 'tool',
      toolCallId: 'tool-call-1',
      name: 'get_page_summary',
      content: JSON.stringify({ url: 'https://example.com', summary: 'Testing page summary' }),
    });
  });

  it('throws when the model requests an unregistered tool', async () => {
    const provider = {
      completeChat: vi.fn<ChatCompletionProvider['completeChat']>().mockResolvedValue({
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'tool-call-404',
              type: 'function',
              function: {
                name: 'missing_tool',
                arguments: '{}',
              },
            },
          ],
        } satisfies LlmAssistantMessage,
      } satisfies ChatCompletionResult),
    } satisfies ChatCompletionProvider;

    await expect(
      completeChat(
        {
          ...defaultSettings.model,
          provider: 'openai',
          model: 'gpt-test',
          openai: {
            ...defaultSettings.model.openai,
            apiKey: 'key',
            model: 'gpt-test',
          },
        },
        [],
        'Try a missing tool',
        undefined,
        undefined,
        {
          provider,
          toolRegistry: createToolRegistry(),
        },
      ),
    ).rejects.toThrow('TOOL_NOT_REGISTERED: missing_tool');
  });

  it('passes multimodal user input through the service message model', async () => {
    const provider = {
      completeChat: vi.fn<ChatCompletionProvider['completeChat']>().mockResolvedValue({
        message: {
          role: 'assistant',
          content: '已收到',
        } satisfies LlmAssistantMessage,
      } satisfies ChatCompletionResult),
    } satisfies ChatCompletionProvider;

    await completeChat(
      {
        ...defaultSettings.model,
        provider: 'openai',
        model: 'gpt-test',
        openai: {
          ...defaultSettings.model.openai,
          apiKey: 'key',
          model: 'gpt-test',
        },
      },
      [
        {
          id: 'history-user-1',
          role: 'user',
          content: [
            { type: 'text', text: '历史图片说明' },
            { type: 'image_url', image_url: { url: 'https://example.com/history.png' } },
          ],
        },
      ],
      [
        { type: 'text', text: '请继续分析' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      ],
      undefined,
      undefined,
      {
        provider,
        toolRegistry: createToolRegistry(),
      },
    );

    const firstCallInput = provider.completeChat.mock.calls[0]?.[0] as ChatCompletionInput;
    expect(firstCallInput.messages).toContainEqual({ role: 'user', content: '历史图片说明' });
    expect(firstCallInput.messages).toContainEqual({
      role: 'user',
      content: [
        { type: 'text', text: '请继续分析' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      ],
    });
  });
});
