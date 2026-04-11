import type { ChatCompletionInput, ChatCompletionProvider, LlmToolCall } from '../model/chat';
import {
  createToolRegistry,
  type ToolRegistry,
} from '../tools/tool-registry';

const defaultMaxIterations = 16;

interface ToolCallOrchestratorOptions {
  provider: ChatCompletionProvider;
  toolRegistry?: ToolRegistry;
  maxIterations?: number;
}

function parseToolArguments(toolCall: LlmToolCall): Record<string, unknown> {
  const rawArguments = toolCall.function.arguments?.trim();

  if (!rawArguments) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArguments) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new Error(`INVALID_TOOL_ARGUMENTS: ${toolCall.function.name}`);
  }
}

export async function runToolCallOrchestrator(
  input: ChatCompletionInput,
  options: ToolCallOrchestratorOptions,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const toolRegistry = options.toolRegistry ?? createToolRegistry();
  const maxIterations = options.maxIterations ?? defaultMaxIterations;
  const messages = [...input.messages];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await options.provider.completeChat(
      {
        model: input.model,
        messages,
        tools: toolRegistry.getDefinitions(),
      },
      onChunk,
      signal,
    );

    const assistantMessage = result.message;
    messages.push(assistantMessage);

    if (!assistantMessage.toolCalls?.length) {
      return assistantMessage.content.trim() || '';
    }

    const toolMessages = await Promise.all(
      assistantMessage.toolCalls.map(async (toolCall) => {
        const tool = toolRegistry.getTool(toolCall.function.name);

        if (!tool) {
          throw new Error(`TOOL_NOT_REGISTERED: ${toolCall.function.name}`);
        }

        const content = await tool.invoke(parseToolArguments(toolCall));

        return {
          role: 'tool' as const,
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          content,
        };
      }),
    );

    messages.push(...toolMessages);
  }

  throw new Error('TOOL_LOOP_LIMIT_EXCEEDED');
}
