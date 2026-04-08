import type {
  ChatCompletionInput,
  ChatCompletionProvider,
  ChatCompletionResult,
  LlmAssistantMessage,
  LlmChatMessage,
  LlmSystemMessage,
  LlmToolCall,
  LlmToolMessage,
  LlmUserMessage,
} from '../model/chat';
import type {ChatContentPart, ChatRole} from '../../shared/types/chat';

/*
https://developers.openai.com/api/reference/resources/responses/streaming-events
https://developers.openai.com/api/reference/resources/responses/methods/create
 */

export interface CodexProviderConfig {
  baseUrl: string;
  accessToken: string;
}

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

interface ResponsesMessage {
  type: 'message';
  role: 'user' | 'assistant';
  content: Array<
    | {
        type: 'input_text';
        text: string;
      }
    | {
        type: 'input_image';
        image_url: string;
      }
    | {
      type: 'output_text';
      text: string;
    }
        | {
      type: 'output_image';
      image_url: string;
    }
  >;
}

interface StreamedFunctionCallState {
  itemId?: string;
  callId: string;
  name: string;
  arguments: string;
}

function toResponsesMessageContent(role: ChatRole, content: string | ChatContentPart[]): ResponsesMessage['content'] {
  if (typeof content === 'string') {
    return [{ type: role === 'user' ? 'input_text': 'output_text', text: content }];
  }

  const blocks: ResponsesMessage['content'] = [];

  content.forEach((part) => {
    if (part.type === 'text') {
      blocks.push({ type: role === 'user' ? 'input_text': 'output_text', text: part.text });
      return;
    }

    blocks.push({ type: role === 'user' ? 'input_image': 'output_image', image_url: part.image_url.url });
  });

  return blocks;
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

function splitInstructionsAndInput(messages: LlmChatMessage[]): {
  instructions?: string;
  input: unknown[];
} {
  let instructions: string | undefined;
  const input: unknown[] = [];

  messages.forEach((message) => {
    if (message.role === 'system') {
      const systemMessage = message as LlmSystemMessage;
      if (!instructions) {
        instructions = systemMessage.content;
      }
      return;
    }

    if (message.role === 'user') {
      const userMessage = message as LlmUserMessage;
      const contentBlocks = toResponsesMessageContent(message.role, userMessage.content);

      if (contentBlocks.length && contentBlocks.some((part) => part.type !== 'input_text' || part.text)) {
        input.push({
          type: 'message',
          role: userMessage.role,
          content: contentBlocks,
        } satisfies ResponsesMessage);
      }

      return;
    }

    if (message.role === 'assistant') {
      const assistantMessage = message as LlmAssistantMessage;
      const contentBlocks = toResponsesMessageContent(message.role, assistantMessage.content);

      if (contentBlocks.length && contentBlocks.some((part) => part.type !== 'input_text' || part.text)) {
        input.push({
          type: 'message',
          role: assistantMessage.role,
          content: contentBlocks,
        } satisfies ResponsesMessage);
      }

      if (assistantMessage.toolCalls?.length) {
        assistantMessage.toolCalls.forEach((toolCall: LlmToolCall) => {
          input.push({
            type: 'function_call',
            call_id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          });
        });
      }

      return;
    }

    if (message.role === 'tool') {
      const toolMessage = message as LlmToolMessage;
      input.push({
        type: 'function_call_output',
        call_id: toolMessage.toolCallId,
        output: toolMessage.content,
      });
    }
  });

  return { instructions, input };
}

export class CodexProvider implements ChatCompletionProvider {
  constructor(private readonly config: CodexProviderConfig) {}

  async completeChat(
    input: ChatCompletionInput,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult> {
    if (!this.config.baseUrl || !input.model || !this.config.accessToken) {
      throw new Error('MODEL_MISCONFIGURED');
    }

    const { instructions, input: structuredInput } = splitInstructionsAndInput(input.messages);

    const requestBody: Record<string, unknown> = {
      model: input.model,
      // 按 Responses API 文档要求，启用 streaming，并关闭 store
      stream: true,
      store: false,
    };

    if (structuredInput.length) {
      requestBody.input = structuredInput;
    }

    if (instructions) {
      requestBody.instructions = instructions;
    }

    if (input.tools?.length) {
      // Responses API expects tools[i].name at the top level, while our
      // internal ToolDefinition keeps name/description/parameters under
      // the function field. Here we adapt the shape.
      requestBody.tools = input.tools.map((tool) => {
        const fn = tool.function;
        return {
          type: tool.type,
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        };
      });
    }

    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/codex/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.accessToken}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const rawBody = await response.text();
      throw new Error(rawBody || `REQUEST_FAILED: ${response.status}`);
    }

    if (!response.body) {
      return {
        message: {
          role: 'assistant',
          content: '',
        },
      };
    }

    // 这里采用与 OpenAiCompatibleProvider 类似的 SSE 读取方式，
    // 但按照 Responses API 文档解析 output_text.delta / output_tool_call_arguments.delta 事件。
    const reader = response.body.getReader();
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
          name: input.tools?.[index]?.function.name ?? '',
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
          name: input.tools?.[index]?.function.name ?? event.item.name ?? '',
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
      if (done) break;

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
          // 单个事件解析失败不应中断整体 stream
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
        // 兼容尾部残留片段，失败时继续后续片段
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
      message: {
        role: 'assistant',
        content: assistantContent,
        ...(toolCalls.length ? { toolCalls } : {}),
      },
    };
  }
}
