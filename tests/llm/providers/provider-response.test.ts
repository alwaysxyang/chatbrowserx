import { describe, expect, it } from 'vitest';
import {
  buildAssistantMessageResult,
  getProviderEndpoint,
  throwIfProviderMisconfigured,
} from '../../../src/llm/providers/provider-response';

describe('provider response helpers', () => {
  it('normalizes provider endpoints and rejects incomplete config', () => {
    expect(getProviderEndpoint('https://api.example.com/', '/chat/completions')).toBe(
      'https://api.example.com/chat/completions',
    );
    expect(() => throwIfProviderMisconfigured('', 'model', 'token')).toThrow('MODEL_MISCONFIGURED');
  });

  it('creates stable assistant completion results with optional tool calls', () => {
    expect(buildAssistantMessageResult()).toEqual({
      message: {
        role: 'assistant',
        content: '',
      },
    });

    expect(
      buildAssistantMessageResult({
        content: 'done',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'test_tool',
              arguments: '{}',
            },
          },
        ],
      }),
    ).toEqual({
      message: {
        role: 'assistant',
        content: 'done',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'test_tool',
              arguments: '{}',
            },
          },
        ],
      },
    });
  });
});
