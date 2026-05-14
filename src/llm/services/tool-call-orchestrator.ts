import type { ChatCompletionInput, ChatCompletionProvider, LlmToolCall } from '../model/chat';
import {
  createToolRegistry,
  type ToolRegistry,
  type ToolInvokeResult,
} from '../tools/tool-registry';

const defaultMaxIterations = 512;

interface ToolCallOrchestratorOptions {
  provider: ChatCompletionProvider;
  toolRegistry?: ToolRegistry;
  maxIterations?: number;
}

/**
 * Parse a tool call's JSON arguments into an object payload.
 */
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

/**
 * Convert a tool execution failure into a JSON tool payload that the model can inspect.
 */
function buildToolErrorContent(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ error: message });
}

/**
 * Convert a tool invocation result into the string payload required by tool messages.
 */
function serializeToolResult(result: ToolInvokeResult): string {
  if (typeof result === 'string') {
    return result;
  }

  return JSON.stringify(result) ?? 'null';
}

/**
 * Run the tool loop until the model returns a final assistant message or the loop limit is exceeded.
 */
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
        tools: await toolRegistry.getDefinitions(),
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

        try {
          const content = serializeToolResult(await tool.invoke(parseToolArguments(toolCall)));

          return {
            role: 'tool' as const,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            content,
          };
        } catch (error) {
          return {
            role: 'tool' as const,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            content: buildToolErrorContent(error),
          };
        }
      }),
    );

    messages.push(...toolMessages);
  }

  throw new Error('TOOL_LOOP_LIMIT_EXCEEDED');
}
