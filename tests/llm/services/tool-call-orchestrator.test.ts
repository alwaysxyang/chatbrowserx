import { describe, expect, it, vi } from 'vitest';
import type {
  ChatCompletionProvider,
  ChatCompletionResult,
  LlmAssistantMessage,
} from '../../../src/llm/model/chat';
import { runToolCallOrchestrator } from '../../../src/llm/services/tool-call-orchestrator';
import { createToolRegistry, type LlmToolModule } from '../../../src/llm/tools/tool-registry';

describe('tool call orchestrator', () => {
  it('passes tool invocation context to requested tools', async () => {
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
                  name: 'inspect_context',
                  arguments: '{}',
                },
              },
            ],
          } satisfies LlmAssistantMessage,
        } satisfies ChatCompletionResult)
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: 'ok',
          } satisfies LlmAssistantMessage,
        } satisfies ChatCompletionResult),
    } satisfies ChatCompletionProvider;
    const invoke = vi.fn<LlmToolModule['invoke']>(() => ({ ok: true }));
    const registry = createToolRegistry();
    registry.addTool({
      name: () => 'inspect_context',
      definition: () => ({
        type: 'function',
        function: {
          name: 'inspect_context',
          description: 'Inspects the tool context.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      }),
      invoke,
    });

    await runToolCallOrchestrator(
      { pageToolTabId: 43 },
      {
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'use the tool' }],
      },
      {
        provider,
        toolRegistry: registry,
      },
    );

    expect(invoke).toHaveBeenCalledWith({ pageToolTabId: 43 }, {});
  });
});
