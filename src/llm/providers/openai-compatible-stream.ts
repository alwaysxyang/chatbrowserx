import type { LlmToolCall } from '../model/chat';
import { parseOpenAiCompatibleResponse } from './openai-compatible-wire-format';

export async function readOpenAiCompatibleStream(
  body: ReadableStream<Uint8Array>,
  onChunk?: (chunk: string) => void,
): Promise<{
  content: string;
  toolCalls?: LlmToolCall[];
}> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let assistantContent = '';
  const streamedToolCalls = new Map<number, LlmToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) {
        continue;
      }

      const parsed = parseOpenAiCompatibleResponse(trimmed.substring(6));
      const delta = parsed?.choices?.[0]?.delta;

      if (delta?.content) {
        assistantContent += delta.content;
        onChunk?.(delta.content);
      }

      delta?.tool_calls?.forEach((toolCallDelta) => {
        const index = toolCallDelta.index ?? streamedToolCalls.size;
        const current = streamedToolCalls.get(index) ?? {
          id: toolCallDelta.id ?? `tool_call_${index}`,
          type: 'function',
          function: {
            name: '',
            arguments: '',
          },
        };

        streamedToolCalls.set(index, {
          id: toolCallDelta.id ?? current.id,
          type: 'function',
          function: {
            name: toolCallDelta.function?.name ?? current.function.name,
            arguments: `${current.function.arguments}${toolCallDelta.function?.arguments ?? ''}`,
          },
        });
      });
    }
  }

  const toolCalls = Array.from(streamedToolCalls.entries())
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, toolCall]) => toolCall)
    .filter((toolCall) => toolCall.function.name);

  return {
    content: assistantContent.trim() || '',
    ...(toolCalls.length ? { toolCalls } : {}),
  };
}
