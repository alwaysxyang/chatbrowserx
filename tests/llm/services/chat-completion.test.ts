import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../../src/shared/storage/settings-repository';
import { ChatCompletionService } from '../../../src/llm/services/chat-completion';
import { createToolRegistry, type LlmToolModule } from '../../../src/llm/tools/tool-registry';
import type {
  ChatCompletionProvider,
  ChatCompletionResult,
  ChatCompletionInput,
  LlmAssistantMessage,
} from '../../../src/llm/model/chat';

// Mock the tool-call-orchestrator to inject custom provider and toolRegistry
vi.mock('../../../src/llm/services/tool-call-orchestrator', async () => {
  const actual = await vi.importActual<typeof import('../../../src/llm/services/tool-call-orchestrator')>(
    '../../../src/llm/services/tool-call-orchestrator',
  );
  return {
    ...actual,
    runToolCallOrchestrator: vi.fn(actual.runToolCallOrchestrator),
  };
});

/**
 * Creates the shared chat completion service fixture.
 */
function createService(): ChatCompletionService {
  return new ChatCompletionService({
    settings: {
      ...defaultSettings.model,
      provider: 'openai',
      model: 'gpt-test',
      openai: {
        ...defaultSettings.model.openai,
        apiKey: 'key',
        model: 'gpt-test',
      },
    },
  });
}

/**
 * Creates the page summary tool fixture with a caller-provided invoke behavior.
 *
 * @param invoke - The mock tool implementation.
 * @returns A page summary tool module.
 */
function createPageSummaryTool(invoke: LlmToolModule['invoke']): LlmToolModule {
  return {
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
    invoke,
  };
}

/**
 * Routes the mocked orchestrator through the real implementation with test fixtures.
 *
 * @param provider - Provider fixture used by the real orchestrator.
 * @param tools - Tool fixtures available to the orchestrator.
 * @returns The mocked orchestrator for restoration after the test.
 */
async function installToolLoopFixtures(provider: ChatCompletionProvider, tools: LlmToolModule[] = []) {
  const { runToolCallOrchestrator } = await import('../../../src/llm/services/tool-call-orchestrator');
  const mockRunToolCallOrchestrator = vi.mocked(runToolCallOrchestrator);
  const toolRegistry = createToolRegistry();
  tools.forEach((tool) => toolRegistry.addTool(tool));

  mockRunToolCallOrchestrator.mockImplementation(async (request, _options, onChunk, signal) => {
    const actualOrchestrator = await vi.importActual<typeof import('../../../src/llm/services/tool-call-orchestrator')>(
      '../../../src/llm/services/tool-call-orchestrator',
    );
    return actualOrchestrator.runToolCallOrchestrator(
      request,
      { provider, toolRegistry },
      onChunk,
      signal,
    );
  });

  return mockRunToolCallOrchestrator;
}

describe('ChatCompletionService', () => {
  it('prepends browser tool-use guidance to the configured system prompt', async () => {
    const provider = {
      completeChat: vi.fn<ChatCompletionProvider['completeChat']>().mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'ok',
        } satisfies LlmAssistantMessage,
      } satisfies ChatCompletionResult),
    } satisfies ChatCompletionProvider;

    const mockRunToolCallOrchestrator = await installToolLoopFixtures(provider);
    const service = createService();

    await service.complete([], 'Analyze this page');

    const firstCallInput = provider.completeChat.mock.calls[0]?.[0] as ChatCompletionInput;
    expect(firstCallInput.messages[0]).toMatchObject({ role: 'system' });
    expect(firstCallInput.messages[0]?.content).toContain('stable scan direction');
    expect(firstCallInput.messages[0]?.content).toContain('do not bounce between down and up');
    expect(firstCallInput.messages[0]?.content).toContain('Avoid unnecessary repeated get_current_page_elements calls for the same unchanged viewport');
    expect(firstCallInput.messages[0]?.content).toContain('Refresh page elements after page actions such as scroll, click, type, or drag');
    expect(firstCallInput.messages[0]?.content).toContain('when enough time has passed');
    expect(firstCallInput.messages[0]?.content).toContain('when you judge a fresh snapshot is necessary');
    expect(firstCallInput.messages[0]?.content).toContain('For read-only page analysis');
    expect(firstCallInput.messages[0]?.content).toContain('do not click navigation, outline, menu, toolbar, or AI summary controls');
    expect(firstCallInput.messages[0]?.content).toContain('If a page action reports PAGE_ACTION_SNAPSHOT_EXPIRED');
    expect(firstCallInput.messages[0]?.content).toContain('refresh page elements before retrying');
    expect(firstCallInput.messages[0]?.content).toContain(defaultSettings.model.systemPrompt);

    mockRunToolCallOrchestrator.mockRestore();
  });

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

    const tool = createPageSummaryTool(vi.fn(async ({ url }) => JSON.stringify({ url, summary: 'Testing page summary' })));
    const mockRunToolCallOrchestrator = await installToolLoopFixtures(provider, [tool]);
    const service = createService();

    const reply = await service.complete(
      [{ id: '1', role: 'assistant', content: 'Old answer' }],
      'Summarize the page',
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

    mockRunToolCallOrchestrator.mockRestore();
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

    const mockRunToolCallOrchestrator = await installToolLoopFixtures(provider);
    const service = createService();

    await expect(service.complete([], 'Try a missing tool')).rejects.toThrow('TOOL_NOT_REGISTERED: missing_tool');

    mockRunToolCallOrchestrator.mockRestore();
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

    const mockRunToolCallOrchestrator = await installToolLoopFixtures(provider);
    const service = createService();

    await service.complete(
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

    mockRunToolCallOrchestrator.mockRestore();
  });

  it('serializes non-string tool results before sending them back to the model', async () => {
    const provider = {
      completeChat: vi
        .fn<ChatCompletionProvider['completeChat']>()
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'tool-call-object-1',
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

    const tool = createPageSummaryTool(vi.fn(async ({ url }) => ({ url, summary: 'Testing page summary' })));
    const mockRunToolCallOrchestrator = await installToolLoopFixtures(provider, [tool]);
    const service = createService();

    const reply = await service.complete([], 'Summarize the page');

    expect(reply).toBe('The page is about testing.');
    expect(tool.invoke).toHaveBeenCalledWith({ url: 'https://example.com' });

    const secondCallInput = provider.completeChat.mock.calls[1]?.[0];
    expect(secondCallInput?.messages).toContainEqual({
      role: 'tool',
      toolCallId: 'tool-call-object-1',
      name: 'get_page_summary',
      content: JSON.stringify({ url: 'https://example.com', summary: 'Testing page summary' }),
    });

    mockRunToolCallOrchestrator.mockRestore();
  });

  it('passes tool execution errors back to the model instead of aborting the tool loop', async () => {
    const provider = {
      completeChat: vi
        .fn<ChatCompletionProvider['completeChat']>()
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'tool-call-error-1',
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
            content: 'The tool failed, so I need to explain the limitation.',
          } satisfies LlmAssistantMessage,
        } satisfies ChatCompletionResult),
    } satisfies ChatCompletionProvider;

    const tool = createPageSummaryTool(vi.fn(async () => {
      throw new Error('PAGE_SUMMARY_UNAVAILABLE');
    }));
    const mockRunToolCallOrchestrator = await installToolLoopFixtures(provider, [tool]);
    const service = createService();

    const reply = await service.complete([], 'Summarize the page');

    expect(reply).toBe('The tool failed, so I need to explain the limitation.');
    expect(tool.invoke).toHaveBeenCalledWith({ url: 'https://example.com' });
    expect(provider.completeChat).toHaveBeenCalledTimes(2);

    const secondCallInput = provider.completeChat.mock.calls[1]?.[0];
    expect(secondCallInput?.messages).toContainEqual({
      role: 'tool',
      toolCallId: 'tool-call-error-1',
      name: 'get_page_summary',
      content: JSON.stringify({ error: 'PAGE_SUMMARY_UNAVAILABLE' }),
    });

    mockRunToolCallOrchestrator.mockRestore();
  });

});
