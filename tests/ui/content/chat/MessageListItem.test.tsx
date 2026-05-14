import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MessageListItem } from '../../../../src/ui/content/chat/MessageListItem';
import type { ChatMessage } from '../../../../src/shared/types/chat';
import userEvent from '@testing-library/user-event';

// Mock the copy function
vi.mock('../../../../src/ui/content/chat/copy-message-content', () => ({
  copyMessageContent: vi.fn().mockResolvedValue(undefined),
}));

import { copyMessageContent } from '../../../../src/ui/content/chat/copy-message-content';

describe('MessageListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays user message with image after page refresh', () => {
    const message: ChatMessage = {
      id: 'u1',
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        { type: 'text', text: '分析这张图片' },
      ],
      createdAt: '10:30',
    };

    render(<MessageListItem message={message} isSending={false} />);

    expect(screen.getByText('分析这张图片')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('displays error indicator for interrupted assistant message', () => {
    const message: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: '正在分析图片',
      status: 'error',
      errorMessage: '页面已刷新，当前请求已中断。',
      createdAt: '10:31',
    };

    render(<MessageListItem message={message} isSending={false} />);

    expect(screen.getByText('正在分析图片')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar-error')).toBeInTheDocument();
  });

  it('displays error indicator for interrupted assistant message with empty content', () => {
    const message: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: '页面已刷新，当前请求已中断。',
      status: 'error',
      errorMessage: '页面已刷新，当前请求已中断。',
      createdAt: '10:31',
    };

    render(<MessageListItem message={message} isSending={false} />);

    expect(screen.getByText('页面已刷新，当前请求已中断。')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar-error')).toBeInTheDocument();
  });

  it('displays warning indicator for manually interrupted assistant message', () => {
    const message: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: '已经输出的部分内容',
      status: 'interrupted',
      errorMessage: '用户已停止当前请求。',
      createdAt: '10:31',
    };

    render(<MessageListItem message={message} isSending={false} />);

    expect(screen.getByText('已经输出的部分内容')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar-error')).toBeInTheDocument();
  });

  it('copies text and images when copy button is clicked', async () => {
    const user = userEvent.setup();
    const message: ChatMessage = {
      id: 'u1',
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        { type: 'text', text: '分析这张图片' },
      ],
      createdAt: '10:30',
    };

    render(<MessageListItem message={message} isSending={false} />);

    const copyButton = screen.getByRole('button', { name: /复制消息/i });
    await user.click(copyButton);

    expect(copyMessageContent).toHaveBeenCalledWith(message.content);
  });

  it('copies only text when message has no images', async () => {
    const user = userEvent.setup();
    const message: ChatMessage = {
      id: 'u1',
      role: 'user',
      content: '这是纯文字消息',
      createdAt: '10:30',
    };

    render(<MessageListItem message={message} isSending={false} />);

    const copyButton = screen.getByRole('button', { name: /复制消息/i });
    await user.click(copyButton);

    expect(copyMessageContent).toHaveBeenCalledWith('这是纯文字消息');
  });
});
