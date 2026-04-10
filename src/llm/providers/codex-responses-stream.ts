import type { LlmToolCall } from '../model/chat';
import type { ToolDefinition } from '../tools/tool-registry';

interface ResponsesStreamingEvent {
  delta?: string;
  item_id?: string;
  output_index?: number;
  item?: {
    id?: string;
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    output_index?: number;
  };
  error?: {
    message?: string;
  };
}

interface StreamedFunctionCallState {
  itemId?: string;
  callId: string;
  name: string;
  arguments: string;
}

export async function readCodexResponsesStream(
  body: ReadableStream<Uint8Array>,
  tools: ToolDefinition[] | undefined,
  onChunk?: (chunk: string) => void,
): Promise<{
  content: string;
  toolCalls?: LlmToolCall[];
}> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let assistantContent = '';
  const streamedToolCalls = new Map<number, StreamedFunctionCallState>();
  const itemIdToIndex = new Map<string, number>();

  const processEvent = (event: ResponsesStreamingEvent, fallbackType?: string) => {
    const type = fallbackType ?? '';

    if (type === 'response.output_text.delta') {
      const text = event.delta;
      if (text) {
        assistantContent += text;
        onChunk?.(text);
      }
    }

    if (type === 'response.function_call_arguments.delta') {
      const index =
        event.output_index ??
        (event.item_id ? itemIdToIndex.get(event.item_id) : undefined) ??
        streamedToolCalls.size;

      if (event.item_id) {
        itemIdToIndex.set(event.item_id, index);
      }

      const current = streamedToolCalls.get(index) ?? {
        itemId: event.item_id,
        callId: event.item_id ?? `tool_call_${index}`,
        name: tools?.[index]?.function.name ?? '',
        arguments: '',
      };

      streamedToolCalls.set(index, {
        itemId: event.item_id ?? current.itemId,
        callId: current.callId,
        name: current.name,
        arguments: `${current.arguments}${event.delta ?? ''}`,
      });
    }

    if (type === 'response.output_item.done' && event.item?.type === 'function_call') {
      const index =
        event.output_index ??
        event.item.output_index ??
        (event.item.id ? itemIdToIndex.get(event.item.id) : undefined) ??
        streamedToolCalls.size;

      if (event.item.id) {
        itemIdToIndex.set(event.item.id, index);
      }

      const current = streamedToolCalls.get(index) ?? {
        itemId: event.item.id,
        callId: event.item.call_id ?? event.item.id ?? `tool_call_${index}`,
        name: tools?.[index]?.function.name ?? event.item.name ?? '',
        arguments: '',
      };

      streamedToolCalls.set(index, {
        itemId: event.item.id ?? current.itemId,
        callId: event.item.call_id ?? current.callId,
        name: event.item.name ?? current.name,
        arguments: event.item.arguments ?? current.arguments,
      });
    }

    if (type === 'response.failed') {
      throw new Error(event.error?.message || 'REQUEST_FAILED');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');

      const parsedEvent = parseSseEvent(rawEvent);
      if (!parsedEvent || parsedEvent.data === '[DONE]') {
        continue;
      }

      let event: ResponsesStreamingEvent;
      try {
        event = JSON.parse(parsedEvent.data) as ResponsesStreamingEvent;
      } catch {
        continue;
      }

      processEvent(event, parsedEvent.type);
    }
  }

  const trailingEvents = (() => {
    const parsedEvent = parseSseEvent(buffer);
    if (parsedEvent && buffer.includes('event:')) {
      return [parsedEvent];
    }

    return buffer
      .split('\n')
      .map((line) => parseSseEvent(line.trim()))
      .filter((event): event is { type?: string; data: string } => Boolean(event));
  })();

  for (const event of trailingEvents) {
    if (!event.data || event.data === '[DONE]') {
      continue;
    }

    let parsed: ResponsesStreamingEvent;
    try {
      parsed = JSON.parse(event.data) as ResponsesStreamingEvent;
    } catch {
      continue;
    }

    processEvent(parsed, event.type);
  }

  const toolCalls = Array.from(streamedToolCalls.entries())
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, toolCall]) => ({
      id: toolCall.callId,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments,
      },
    }) satisfies LlmToolCall)
    .filter((toolCall) => toolCall.function.name);

  return {
    content: assistantContent,
    ...(toolCalls.length ? { toolCalls } : {}),
  };
}

function parseSseEvent(rawEvent: string): { type?: string; data: string } | undefined {
  let type: string | undefined;
  const dataLines: string[] = [];

  rawEvent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) {
      return;
    }

    if (trimmed.startsWith('event:')) {
      type = trimmed.slice(6).trim();
      return;
    }

    if (trimmed.startsWith('data:')) {
      dataLines.push(trimmed.slice(5).trimStart());
    }
  });

  if (!dataLines.length) {
    return undefined;
  }

  return {
    type,
    data: dataLines.join('\n'),
  };
}
