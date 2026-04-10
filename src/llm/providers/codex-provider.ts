import type {
  ChatCompletionInput,
  ChatCompletionProvider,
  ChatCompletionResult,
} from '../model/chat';
import { splitInstructionsAndInput, toCodexResponsesTools } from './codex-responses-format';
import { readCodexResponsesStream } from './codex-responses-stream';

/*
https://developers.openai.com/api/reference/resources/responses/streaming-events
https://developers.openai.com/api/reference/resources/responses/methods/create
 */

export interface CodexProviderConfig {
  baseUrl: string;
  accessToken: string;
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
      requestBody.tools = toCodexResponsesTools(input.tools);
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
    const assistantMessage = await readCodexResponsesStream(response.body, input.tools, onChunk);

    return {
      message: {
        role: 'assistant',
        content: assistantMessage.content,
        ...(assistantMessage.toolCalls?.length ? { toolCalls: assistantMessage.toolCalls } : {}),
      },
    };
  }
}
