import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChatController } from '../../../../src/ui/content/chat/use-chat-controller';

const emptyStateResponse = {
  ok: true,
  data: {
    messages: [],
    isRunning: false,
    requestId: null,
    activeAssistantMessageId: null,
  },
};

describe('useChatController', () => {
  it('queries global chat state on mount and renders a running task', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValueOnce({
      ok: true,
      data: {
        messages: [
          { id: 'u1', role: 'user', content: '正在执行' },
          { id: 'a1', role: 'assistant', content: '处理中', status: 'streaming' },
        ],
        isRunning: true,
        requestId: 7,
        activeAssistantMessageId: 'a1',
      },
    });

    const { result } = renderHook(() => useChatController());

    await waitFor(() => {
      expect(result.current.isSending).toBe(true);
      expect(result.current.messages).toHaveLength(2);
    });

    expect(sendMessageMock).toHaveBeenCalledWith({ type: 'chatbrowserx.chat.state.query' });
  });

  it('applies full state sync messages from background', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValueOnce(emptyStateResponse);

    const { result } = renderHook(() => useChatController());

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: 'chatbrowserx.chat.state.query' });
    });

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.chat.state.sync',
        payload: {
          messages: [{ id: 'a1', role: 'assistant', content: '同步内容' }],
          isRunning: true,
          requestId: 9,
          activeAssistantMessageId: 'a1',
        },
      });
    });

    expect(result.current.isSending).toBe(true);
    expect(result.current.messages).toEqual([{ id: 'a1', role: 'assistant', content: '同步内容' }]);
  });

  it('appends matching stream chunks and ignores stale request ids', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValueOnce({
      ok: true,
      data: {
        messages: [{ id: 'a1', role: 'assistant', content: '处理中', status: 'streaming' }],
        isRunning: true,
        requestId: 7,
        activeAssistantMessageId: 'a1',
      },
    });

    const { result } = renderHook(() => useChatController());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.chat.stream.chunk',
        payload: { requestId: 8, messageId: 'a1', content: ' stale' },
      });
    });

    expect(result.current.messages[0].content).toBe('处理中');

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.chat.stream.chunk',
        payload: { requestId: 7, messageId: 'a1', content: ' done' },
      });
    });

    expect(result.current.messages[0].content).toBe('处理中 done');
  });

  it('sends chat requests through background without local history ownership', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock
      .mockResolvedValueOnce(emptyStateResponse)
      .mockResolvedValueOnce({
        ok: true,
        data: { reply: 'assistant reply' },
      });

    const { result } = renderHook(() => useChatController());

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: 'chatbrowserx.chat.state.query' });
    });

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(sendMessageMock).toHaveBeenLastCalledWith({
      type: 'chatbrowserx.chat.request',
      payload: {
        input: 'hello',
      },
    });
  });

  it('sends stop only while a global request is running', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValueOnce({
      ok: true,
      data: {
        messages: [],
        isRunning: true,
        requestId: 7,
        activeAssistantMessageId: 'a1',
      },
    });

    const { result } = renderHook(() => useChatController());

    await waitFor(() => {
      expect(result.current.isSending).toBe(true);
    });

    await act(async () => {
      await result.current.stop();
    });

    expect(sendMessageMock).toHaveBeenLastCalledWith({ type: 'chatbrowserx.chat.cancel' });
  });

  it('clears history through background and waits for state sync', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          messages: [{ id: 'm1', role: 'assistant', content: 'stored reply' }],
          isRunning: false,
          requestId: null,
          activeAssistantMessageId: null,
        },
      })
      .mockResolvedValueOnce({ ok: true, data: null });

    const { result } = renderHook(() => useChatController());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(sendMessageMock).toHaveBeenLastCalledWith({ type: 'chatbrowserx.chat.clear' });
  });
});
