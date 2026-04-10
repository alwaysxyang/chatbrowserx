import type {
  LlmAssistantMessage,
  LlmChatMessage,
  LlmSystemMessage,
  LlmToolCall,
  LlmToolMessage,
  LlmUserMessage,
} from '../model/chat';
import type { ChatContentPart, ChatRole } from '../../shared/types/chat';
import type { ToolDefinition } from '../tools/tool-registry';

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

export function splitInstructionsAndInput(messages: LlmChatMessage[]): {
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

export function toCodexResponsesTools(tools: ToolDefinition[] | undefined) {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map((tool) => {
    const fn = tool.function;
    return {
      type: tool.type,
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    };
  });
}

function toResponsesMessageContent(role: ChatRole, content: string | ChatContentPart[]): ResponsesMessage['content'] {
  if (typeof content === 'string') {
    return [{ type: role === 'user' ? 'input_text' : 'output_text', text: content }];
  }

  const blocks: ResponsesMessage['content'] = [];

  content.forEach((part) => {
    if (part.type === 'text') {
      blocks.push({ type: role === 'user' ? 'input_text' : 'output_text', text: part.text });
      return;
    }

    blocks.push({ type: role === 'user' ? 'input_image' : 'output_image', image_url: part.image_url.url });
  });

  return blocks;
}
