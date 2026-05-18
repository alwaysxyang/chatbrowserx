import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmOrchestrator } from '../../../src/background/llm/llm-orchestrator';
import { ChatCompletionService } from '../../../src/llm/services/chat-completion';

const completeMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/shared/storage/settings-repository', () => ({
  loadSettings: vi.fn(async () => ({
    model: {
      provider: 'openai',
      model: 'gpt-test',
      systemPrompt: '',
      maxHistory: 10,
      tavilyApiKey: '',
      openai: { baseUrl: 'https://example.com', apiKey: 'key', model: 'gpt-test' },
      codex: { baseUrl: '', accessToken: '', model: '', effort: 'medium' },
    },
  })),
}));

vi.mock('../../../src/llm/services/chat-completion', () => ({
  ChatCompletionService: vi.fn().mockImplementation(() => ({
    complete: completeMock,
  })),
}));

describe('LlmOrchestrator', () => {
  beforeEach(() => {
    completeMock.mockReset();
    vi.mocked(ChatCompletionService).mockClear();
  });

  it('allows independent numeric and string request scopes', async () => {
    completeMock
      .mockResolvedValueOnce('global reply')
      .mockResolvedValueOnce('selection reply');

    const orchestrator = new LlmOrchestrator();

    await expect(orchestrator.complete(undefined, 'global-chat', { history: [], input: 'hi' })).resolves.toEqual({ reply: 'global reply' });
    await expect(orchestrator.complete(undefined, 12, { history: [], input: 'selection' })).resolves.toEqual({ reply: 'selection reply' });
  });

  it('passes the request tab context to the chat completion service', async () => {
    completeMock.mockResolvedValue('global reply');
    const serviceMock = vi.mocked(ChatCompletionService);
    const orchestrator = new LlmOrchestrator();
    const requestContext = { pageToolTabId: 43 };

    await orchestrator.complete(requestContext, 'global-chat', { history: [], input: 'hi' });

    expect(serviceMock.mock.calls[0]?.[0]).not.toHaveProperty('toolContext');
    expect(serviceMock.mock.calls[0]?.[0]).not.toHaveProperty('pageToolTabId');
    expect(completeMock.mock.calls[0]?.[0]).toBe(requestContext);
  });

  it('cancels only the requested scope', async () => {
    const abortSignals: AbortSignal[] = [];
    completeMock.mockImplementation((_context, _history, _input, _onChunk, signal: AbortSignal) => {
      abortSignals.push(signal);
      return new Promise(() => undefined);
    });

    const orchestrator = new LlmOrchestrator();
    void orchestrator.complete(undefined, 'global-chat', { history: [], input: 'hi' });
    void orchestrator.complete(undefined, 12, { history: [], input: 'selection' });

    await vi.waitFor(() => {
      expect(abortSignals).toHaveLength(2);
    });

    orchestrator.cancel('global-chat');

    expect(abortSignals[0]?.aborted).toBe(true);
    expect(abortSignals[1]?.aborted).toBe(false);
  });
});
