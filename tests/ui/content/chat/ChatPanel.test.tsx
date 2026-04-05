import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChatPanel } from '../../../../src/ui/content/chat/ChatPanel';
import { MessageList } from '../../../../src/ui/content/chat/MessageList';
import type { ChatMessage } from '../../../../src/shared/types/chat';

describe('ChatPanel', () => {
  it('shows a default assistant conversation bubble in empty state', () => {
    render(
      <ChatPanel
        messages={[]}
        isSending={false}
        errorMessage={null}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
      />,
    );

    expect(screen.getByText(/你好！我是你的 AI 助手/)).toBeInTheDocument();
    expect(screen.queryByText('我今天能帮你什么？')).not.toBeInTheDocument();
  });

  it('renders conversation bubbles in the 1.png style with timestamps', () => {
    const messages: ChatMessage[] = [
      { id: 'a1', role: 'assistant', content: '你好，我是助手。', createdAt: '10:30' },
      { id: 'u1', role: 'user', content: '23', createdAt: '22:00' },
    ];

    render(
      <ChatPanel
        messages={messages}
        isSending={false}
        errorMessage={null}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
      />,
    );

    expect(screen.getByText('你好，我是助手。')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
    expect(screen.getByText('22:00')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar-completed')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('renders error messages as assistant bubbles with error status icon', () => {
    render(
      <ChatPanel
        messages={[
          {
            id: 'e1',
            role: 'assistant',
            content: '请先在设置中填写 API Base URL、API Key 和 Model。',
            status: 'error',
          },
        ]}
        isSending={false}
        errorMessage={null}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
      />,
    );

    expect(screen.getByText('请先在设置中填写 API Base URL、API Key 和 Model。')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar-error')).toBeInTheDocument();
  });

  it('shows loading state with the loading assistant avatar', async () => {
    render(
      <ChatPanel
        messages={[]}
        isSending
        errorMessage={null}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
      />,
    );

    expect(screen.getByTestId('assistant-avatar-loading')).toBeInTheDocument();
    expect(screen.getByText('正在生成回复...')).toBeInTheDocument();
  });

  it('sends a message through the composer', async () => {
    const user = userEvent.setup();
    const messages: ChatMessage[] = [];

    const onSendMessage = vi.fn(async () => '你好，我是助手');

    render(
      <ChatPanel
        messages={messages}
        isSending={false}
        errorMessage={null}
        onSendMessage={onSendMessage}
        onClearHistory={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示');

    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith('你好');
    });

    expect(screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示')).toHaveValue('');

    expect(screen.queryByRole('button', { name: '打开设置' })).not.toBeInTheDocument();
    expect(screen.queryByText('Agent Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('浏览器增强 Agent')).not.toBeInTheDocument();
  });

  it('sends a message with Command+Enter', async () => {
    const user = userEvent.setup();
    const messages: ChatMessage[] = [];

    const onSendMessage = vi.fn(async () => '你好，我是助手');

    render(
      <ChatPanel
        messages={messages}
        isSending={false}
        errorMessage={null}
        onSendMessage={onSendMessage}
        onClearHistory={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示');

    await user.type(input, '快捷键');
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith('快捷键');
    });

    expect(screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示')).toHaveValue('');

    expect(screen.queryByRole('button', { name: '打开设置' })).not.toBeInTheDocument();
    expect(screen.queryByText('Agent Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('浏览器增强 Agent')).not.toBeInTheDocument();
  });

  it('clears the draft when send fails', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn(async () => {
      throw new Error('network fail');
    });

    render(
      <ChatPanel
        messages={[]}
        isSending={false}
        errorMessage={null}
        onSendMessage={onSendMessage}
        onClearHistory={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示'), '重试内容');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示')).toHaveValue('');
    });
  });

  it('auto scrolls the message list to bottom when messages change', () => {
    const messages: ChatMessage[] = [
      { id: 'a1', role: 'assistant', content: 'first', createdAt: '10:30' },
    ];

    const { rerender } = render(<MessageList errorMessage={null} isSending={false} messages={messages} />);

    const list = screen.getByTestId('message-list');
    Object.defineProperty(list, 'scrollHeight', { value: 480, configurable: true });
    Object.defineProperty(list, 'scrollTop', { value: 0, writable: true, configurable: true });

    rerender(
      <MessageList
        errorMessage={null}
        isSending={false}
        messages={[...messages, { id: 'u1', role: 'user', content: 'second', createdAt: '10:31' }]}
      />,
    );

    expect(list.scrollTop).toBe(480);
  });
});
