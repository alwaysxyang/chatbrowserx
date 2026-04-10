import type { ChatContentPart } from '../../shared/types/chat';
import type { LlmChatMessage } from '../model/chat';

export interface OpenAiCompatibleResponse {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export function toOpenAiCompatibleWireMessage(message: LlmChatMessage): Record<string, unknown> {
  if (message.role === 'user') {
    return {
      role: 'user',
      content: toOpenAiCompatibleUserContent(message.content),
    };
  }

  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: toolCall.type,
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            })),
          }
        : {}),
    };
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

export function parseOpenAiCompatibleResponse(rawBody: string): OpenAiCompatibleResponse | undefined {
  try {
    return JSON.parse(rawBody) as OpenAiCompatibleResponse;
  } catch {
    return undefined;
  }
}

function toOpenAiCompatibleUserContent(content: string | ChatContentPart[]): string | ChatContentPart[] {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((part) => {
    if (part.type === 'text') {
      return {
        type: 'text' as const,
        text: part.text,
      };
    }

    return {
      type: 'image_url' as const,
      image_url: {
        url: part.image_url.url,
      },
    };
  });
}
