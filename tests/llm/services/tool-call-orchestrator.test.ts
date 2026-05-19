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

  it('runs model-requested tool calls sequentially within one assistant turn', async () => {
    let releaseFirstTool: () => void = () => undefined;
    const firstToolDone = new Promise<void>((resolve) => {
      releaseFirstTool = resolve;
    });
    const events: string[] = [];
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
                  name: 'first_tool',
                  arguments: '{}',
                },
              },
              {
                id: 'tool-call-2',
                type: 'function',
                function: {
                  name: 'second_tool',
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
    const registry = createToolRegistry();

    registry.addTool({
      name: () => 'first_tool',
      definition: () => ({
        type: 'function',
        function: {
          name: 'first_tool',
          description: 'Runs first.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      }),
      invoke: async () => {
        events.push('first:start');
        await firstToolDone;
        events.push('first:end');
        return { ok: true };
      },
    });
    registry.addTool({
      name: () => 'second_tool',
      definition: () => ({
        type: 'function',
        function: {
          name: 'second_tool',
          description: 'Runs second.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      }),
      invoke: () => {
        events.push('second');
        return { ok: true };
      },
    });

    const runPromise = runToolCallOrchestrator(
      undefined,
      {
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'use both tools' }],
      },
      {
        provider,
        toolRegistry: registry,
      },
    );

    await vi.waitFor(() => {
      expect(events).toContain('first:start');
    });
    await Promise.resolve();

    try {
      expect(events).toEqual(['first:start']);
    } finally {
      releaseFirstTool();
      await runPromise;
    }

    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });
});
