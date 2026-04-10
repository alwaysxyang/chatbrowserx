import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getChatMessageTextContent } from '../../../../src/shared/types/chat';
import { useChatController } from '../../../../src/ui/content/chat/use-chat-controller';

describe('useChatController', () => {
  it('sends only previous history to background and appends the reply', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;

    sendMessageMock.mockResolvedValue({
      ok: true,
      data: { reply: 'assistant reply' },
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'chatbrowserx.chat.request',
      payload: {
        input: 'hello',
        history: [],
      },
    });

    await waitFor(() => {
      expect(result.current.messages.map((message) => message.content)).toEqual(['hello', 'assistant reply']);
    });
  });

  it('hydrates stored history without overwriting it on mount', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.history.example.com': [
        { id: 'm1', role: 'assistant', content: 'stored reply' },
      ],
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    const persisted = await chrome.storage.local.get('chatbrowserx.history.example.com');
    expect(persisted['chatbrowserx.history.example.com']).toEqual([
      { id: 'm1', role: 'assistant', content: 'stored reply' },
    ]);
  });

  it('clears chat history from state and storage', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.history.example.com': [
        { id: 'm1', role: 'assistant', content: 'stored reply' },
      ],
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(result.current.messages).toEqual([]);

    const persisted = await chrome.storage.local.get('chatbrowserx.history.example.com');
    expect(persisted['chatbrowserx.history.example.com']).toBeUndefined();
  });

  it('appends a new assistant error message for each failed send', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockRejectedValue(new Error('请先在设置中填写 API Base URL、API Key 和 Model。'));

    const { result } = renderHook(() => useChatController('example.com'));

    await act(async () => {
      await expect(result.current.sendMessage('first')).rejects.toThrow();
    });

    await act(async () => {
      await expect(result.current.sendMessage('second')).rejects.toThrow();
    });

    const assistantErrors = result.current.messages.filter(
      (message) => message.role === 'assistant' && getChatMessageTextContent(message.content).includes('请先在设置中填写'),
    );

    expect(assistantErrors).toHaveLength(2);
  });

  it('uses runtime error payloads when the background resolves with ok false', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({
      ok: false,
      error: '后台报错',
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await act(async () => {
      await expect(result.current.sendMessage('first')).rejects.toThrow('后台报错');
    });

    expect(result.current.messages.at(-1)).toMatchObject({
      role: 'assistant',
      status: 'error',
      errorMessage: '后台报错',
    });
  });

  it('strips images from history before sending the next request', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({
      ok: true,
      data: { reply: 'assistant reply' },
    });

    await chrome.storage.local.set({
      'chatbrowserx.history.example.com': [
        {
          id: 'u1',
          role: 'user',
          content: [
            { type: 'text', text: '历史图片说明' },
            { type: 'image_url', image_url: { url: 'https://example.com/history.png' } },
          ],
        },
        { id: 'a1', role: 'assistant', content: '上一轮回复' },
      ],
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    await act(async () => {
      await result.current.sendMessage('新问题');
    });

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'chatbrowserx.chat.request',
      payload: {
        input: '新问题',
        history: [
          { id: 'u1', role: 'user', content: '历史图片说明' },
          { id: 'a1', role: 'assistant', content: '上一轮回复' },
        ],
      },
    });
  });

  it('preserves screenshots in the current multimodal input', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({
      ok: true,
      data: { reply: 'assistant reply' },
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await act(async () => {
      await result.current.sendMessage([
        { type: 'image_url', image_url: { url: 'data:image/png;base64,shot1' } },
        { type: 'text', text: '帮我看这张图' },
      ]);
    });

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'chatbrowserx.chat.request',
      payload: {
        input: [
          { type: 'image_url', image_url: { url: 'data:image/png;base64,shot1' } },
          { type: 'text', text: '帮我看这张图' },
        ],
        history: [],
      },
    });
  });

  it('keeps persisted pending replies out of hydration until that behavior is implemented', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.history.example.com': [{ id: 'u1', role: 'user', content: '上一轮提问' }],
      'chatbrowserx.pending.example.com': {
        content: '未完成的回答',
        errorMessage: '页面已刷新，当前请求已中断。',
        createdAt: '10:32',
      },
    });

    const { result } = renderHook(() => useChatController('example.com'));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: '上一轮提问',
    });

    const persisted = await chrome.storage.local.get('chatbrowserx.pending.example.com');
    expect(persisted['chatbrowserx.pending.example.com']).toEqual({
      content: '未完成的回答',
      errorMessage: '页面已刷新，当前请求已中断。',
      createdAt: '10:32',
    });
  });
});
