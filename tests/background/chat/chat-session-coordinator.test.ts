import { describe, expect, it, vi } from 'vitest';
import { ChatSessionCoordinator } from '../../../src/background/chat/chat-session-coordinator';
import type { ChatMessage } from '../../../src/shared/types/chat';

/**
 * Creates a minimal orchestrator fixture for global chat coordinator tests.
 *
 * @param reply - Final assistant reply returned by the fixture.
 * @returns Mock orchestrator methods.
 */
function createOrchestrator(reply = 'final reply') {
  return {
    complete: vi.fn(async (_scope, _payload, onChunk?: (chunk: string) => void) => {
      onChunk?.('stream ');
      return { reply };
    }),
    cancel: vi.fn(),
  };
}

describe('ChatSessionCoordinator', () => {
  it('starts one global request, streams chunks, persists history, and broadcasts state', async () => {
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();
    const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
    tabsQueryMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    tabsSendMessageMock.mockResolvedValue(undefined);
    const orchestrator = createOrchestrator();
    const coordinator = new ChatSessionCoordinator(orchestrator);

    await expect(coordinator.request({ input: 'hello', history: [] })).resolves.toEqual({ reply: 'final reply' });

    expect(orchestrator.complete).toHaveBeenCalledWith('global-chat', expect.objectContaining({ input: 'hello' }), expect.any(Function));
    expect(tabsSendMessageMock).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'chatbrowserx.chat.stream.chunk' }));
    expect(tabsSendMessageMock).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'chatbrowserx.chat.stream.chunk' }));
    expect((await chrome.storage.local.get('chatbrowserx.history'))['chatbrowserx.history']).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'hello' }),
      expect.objectContaining({ role: 'assistant', content: 'final reply', status: 'completed' }),
    ]));
  });

  it('waits for streaming chunk side effects before resolving the final request', async () => {
    const storageSetMock = chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>;
    const defaultStorageSet = storageSetMock.getMockImplementation();
    let releaseChunkSave: () => void = () => undefined;
    const chunkSave = new Promise<void>((resolve) => {
      releaseChunkSave = resolve;
    });

    storageSetMock.mockImplementation((items: Record<string, unknown>) => {
      const messages = items['chatbrowserx.history'] as ChatMessage[] | undefined;
      const assistantMessage = messages?.find((message) => message.role === 'assistant');
      if (assistantMessage?.status === 'streaming' && assistantMessage.content === 'stream ') {
        return chunkSave;
      }
      return Promise.resolve();
    });

    try {
      const orchestrator = createOrchestrator();
      const coordinator = new ChatSessionCoordinator(orchestrator);
      let requestResolved = false;
      const requestPromise = coordinator.request({ input: 'hello', history: [] }).then((response) => {
        requestResolved = true;
        return response;
      });

      await vi.waitFor(() => {
        expect(orchestrator.complete).toHaveBeenCalled();
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(requestResolved).toBe(false);

      releaseChunkSave();
      await expect(requestPromise).resolves.toEqual({ reply: 'final reply' });
    } finally {
      if (defaultStorageSet) {
        storageSetMock.mockImplementation(defaultStorageSet);
      }
    }
  });

  it('preserves streamed assistant content when a request fails', async () => {
    const orchestrator = {
      complete: vi.fn(async (_scope, _payload, onChunk?: (chunk: string) => void) => {
        onChunk?.('partial answer');
        throw new Error('provider failed');
      }),
      cancel: vi.fn(),
    };
    const coordinator = new ChatSessionCoordinator(orchestrator);

    await expect(coordinator.request({ input: 'hello', history: [] })).rejects.toThrow('provider failed');

    await expect(coordinator.getState()).resolves.toMatchObject({
      messages: [
        expect.objectContaining({ role: 'user', content: 'hello' }),
        expect.objectContaining({
          role: 'assistant',
          content: 'partial answer',
          status: 'error',
          errorMessage: 'provider failed',
        }),
      ],
    });
  });

  it('builds request history from completed turns only', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.history': [
        {
          id: 'user-completed',
          role: 'user',
          content: 'completed user',
        },
        {
          id: 'assistant-completed',
          role: 'assistant',
          content: 'completed assistant',
          status: 'completed',
        },
        {
          id: 'user-interrupted',
          role: 'user',
          content: 'interrupted user',
        },
        {
          id: 'assistant-interrupted',
          role: 'assistant',
          content: 'partial interrupted answer',
          status: 'interrupted',
        },
      ],
    });
    const orchestrator = createOrchestrator();
    const coordinator = new ChatSessionCoordinator(orchestrator);

    await coordinator.request({ input: 'next user', history: [] });

    expect(orchestrator.complete.mock.calls[0]?.[1].history).toEqual([
      expect.objectContaining({ role: 'user', content: 'completed user' }),
      expect.objectContaining({ role: 'assistant', content: 'completed assistant' }),
    ]);
    expect(orchestrator.complete.mock.calls[0]?.[1].history).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'interrupted user' }),
      expect.objectContaining({ role: 'assistant', content: 'partial interrupted answer' }),
    ]));
  });

  it('persists stale streaming messages as interrupted background sessions during hydration', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.history': [
        {
          id: 'user-1',
          role: 'user',
          content: 'previous user',
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'partial answer',
          status: 'streaming',
        },
      ],
    });
    const coordinator = new ChatSessionCoordinator(createOrchestrator());

    await expect(coordinator.getState()).resolves.toMatchObject({
      messages: [
        expect.objectContaining({ role: 'user', content: 'previous user' }),
        expect.objectContaining({
          role: 'assistant',
          content: 'partial answer',
          status: 'error',
          errorMessage: '后台会话已结束，当前请求已中断。',
        }),
      ],
    });
    await expect(chrome.storage.local.get('chatbrowserx.history')).resolves.toMatchObject({
      'chatbrowserx.history': [
        expect.objectContaining({ role: 'user', content: 'previous user' }),
        expect.objectContaining({
          role: 'assistant',
          content: 'partial answer',
          status: 'error',
          errorMessage: '后台会话已结束，当前请求已中断。',
        }),
      ],
    });
  });

  it('rejects concurrent requests without canceling the running request', async () => {
    const orchestrator = {
      complete: vi.fn((): Promise<never> => new Promise(() => undefined)),
      cancel: vi.fn(),
    };
    const coordinator = new ChatSessionCoordinator(orchestrator);

    void coordinator.request({ input: 'first', history: [] });
    await vi.waitFor(async () => {
      await expect(coordinator.getState()).resolves.toMatchObject({ isRunning: true });
    });

    await expect(coordinator.request({ input: 'second', history: [] })).rejects.toThrow('CHAT_SESSION_BUSY');
    expect(orchestrator.cancel).not.toHaveBeenCalled();
  });

  it('returns current running state to new content tabs', async () => {
    const orchestrator = {
      complete: vi.fn((): Promise<never> => new Promise(() => undefined)),
      cancel: vi.fn(),
    };
    const coordinator = new ChatSessionCoordinator(orchestrator);

    void coordinator.request({ input: 'first', history: [] });

    await vi.waitFor(async () => {
      await expect(coordinator.getState()).resolves.toMatchObject({
        isRunning: true,
        requestId: 1,
        messages: [
          expect.objectContaining({ role: 'user', content: 'first' }),
          expect.objectContaining({ role: 'assistant', status: 'streaming' }),
        ],
      });
    });
  });

  it('cancels the global request only on explicit stop', async () => {
    const orchestrator = createOrchestrator();
    const coordinator = new ChatSessionCoordinator(orchestrator);

    await coordinator.cancel();

    expect(orchestrator.cancel).toHaveBeenCalledWith('global-chat');
  });
});
