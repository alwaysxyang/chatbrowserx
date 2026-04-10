import type { ChatCompletionResult, LlmAssistantMessage } from '../../model/chat';

export function throwIfProviderMisconfigured(baseUrl: string, model: string, credential: string): void {
  if (!baseUrl || !model || !credential) {
    throw new Error('MODEL_MISCONFIGURED');
  }
}

export function getProviderEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildAssistantMessageResult(message?: Partial<LlmAssistantMessage>): ChatCompletionResult {
  return {
    message: {
      role: 'assistant',
      content: message?.content ?? '',
      ...(message?.toolCalls?.length ? { toolCalls: message.toolCalls } : {}),
    },
  };
}
