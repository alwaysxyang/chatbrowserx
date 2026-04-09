import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChatPanel } from '../../../../src/ui/content/chat/ChatPanel';
import { MessageList } from '../../../../src/ui/content/chat/MessageList';
import { setCurrentUiLanguage } from '../../../../src/shared/i18n/current-language';
import type { ChatMessage } from '../../../../src/shared/types/chat';

describe('ChatPanel', () => {
  afterEach(() => {
    setCurrentUiLanguage('zh');
  });

  it('adds pasted images to the composer screenshots', async () => {
    const originalFileReader = globalThis.FileReader;
    const file = new File(['image-bytes'], 'paste.png', { type: 'image/png' });

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(_file: Blob) {
        this.result = 'data:image/png;base64,pasted';
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: MockFileReader,
    });

    try {
      render(
        <ChatPanel
          messages={[]}
          isSending={false}
          onSendMessage={vi.fn(async () => 'unused')}
          onClearHistory={vi.fn()}
        />,
      );

      fireEvent.paste(screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示'), {
        clipboardData: {
          items: [
            {
              kind: 'file',
              type: 'image/png',
              getAsFile: () => file,
            },
          ],
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('img', { name: '截图预览' })).toHaveAttribute(
          'src',
          'data:image/png;base64,pasted',
        );
      });
    } finally {
      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        value: originalFileReader,
      });
    }
  });

  it('shows a default assistant conversation bubble in empty state', () => {
    render(
      <ChatPanel
        messages={[]}
        isSending={false}
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

  it('renders user message with images first and text below', () => {
    const { container } = render(
      <MessageList
        isSending={false}
        messages={[
          {
            id: 'u-with-image',
            role: 'user',
            content: [
              { type: 'text', text: '帮我看下这些图片' },
              { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
            ],
            createdAt: '10:35',
          },
        ]}
      />,
    );

    expect(screen.getByText('帮我看下这些图片')).toBeInTheDocument();
    const images = screen.getAllByRole('img', { name: '用户上传图片' });
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', 'https://example.com/a.png');
    expect(images[1]).toHaveAttribute('src', 'data:image/png;base64,abc123');

    const content = container.querySelector('.message-content');
    expect(content?.firstElementChild?.tagName).toBe('IMG');
    expect(content?.textContent).toContain('帮我看下这些图片');
  });

  it('previews message images in the center on double click', async () => {
    const user = userEvent.setup();
    const onPreviewImage = vi.fn();

    render(
      <MessageList
        isSending={false}
        onPreviewImage={onPreviewImage}
        messages={[
          {
            id: 'u-with-image',
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }],
          },
        ]}
      />,
    );

    await user.dblClick(screen.getByRole('img', { name: '用户上传图片' }));

    expect(onPreviewImage).toHaveBeenCalledWith('data:image/png;base64,abc123');
  });

  it('translates uploaded image alt text', () => {
    setCurrentUiLanguage('en');

    render(
      <MessageList
        isSending={false}
        messages={[
          {
            id: 'u-with-image-en',
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'https://example.com/a.png' } }],
          },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: 'Uploaded image' })).toBeInTheDocument();
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
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
      />,
    );

    expect(screen.getByText('请先在设置中填写 API Base URL、API Key 和 Model。')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar-error')).toBeInTheDocument();
  });

  it('shows loading state with the loading assistant avatar', async () => {
    const messages: ChatMessage[] = [
      { id: 'streaming-assistant', role: 'assistant', content: '', status: 'streaming' },
    ];

    render(
      <ChatPanel
        messages={messages}
        isSending
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

  it('uses screenshot wording for the scissors button', () => {
    render(
      <ChatPanel
        messages={[]}
        isSending={false}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
      />,
    );

    const screenshotButton = screen.getByRole('button', { name: '截图' });
    expect(screenshotButton).toHaveAttribute('data-tooltip', '截图');
  });

  it('adds multiple captured screenshots to the composer and sends them with text', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn(async () => '你好，我是助手');
    const onStartScreenshot = vi.fn((onCaptured: (dataUrl: string) => void) => {
      onCaptured('data:image/png;base64,shot1');
      onCaptured('data:image/png;base64,shot2');
    });

    render(
      <ChatPanel
        messages={[]}
        isSending={false}
        onSendMessage={onSendMessage}
        onClearHistory={vi.fn()}
        onStartScreenshot={onStartScreenshot}
      />,
    );

    await user.click(screen.getByRole('button', { name: '截图' }));
    expect(screen.getAllByRole('img', { name: '截图预览' })).toHaveLength(2);

    await user.type(screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示'), '帮我看');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith([
        { type: 'image_url', image_url: { url: 'data:image/png;base64,shot1' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,shot2' } },
        { type: 'text', text: '帮我看' },
      ]);
    });
  });

  it('previews composer screenshots in the center on double click', async () => {
    const user = userEvent.setup();
    const onPreviewImage = vi.fn();
    const onStartScreenshot = vi.fn((onCaptured: (dataUrl: string) => void) => {
      onCaptured('data:image/png;base64,shot1');
    });

    render(
      <ChatPanel
        messages={[]}
        isSending={false}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
        onStartScreenshot={onStartScreenshot}
        onPreviewImage={onPreviewImage}
      />,
    );

    await user.click(screen.getByRole('button', { name: '截图' }));
    await user.dblClick(screen.getByRole('img', { name: '截图预览' }));

    expect(onPreviewImage).toHaveBeenCalledWith('data:image/png;base64,shot1');
  });

  it('removes the last screenshot with the delete key when the draft is empty', async () => {
    const user = userEvent.setup();
    const onStartScreenshot = vi.fn((onCaptured: (dataUrl: string) => void) => {
      onCaptured('data:image/png;base64,shot1');
    });

    render(
      <ChatPanel
        messages={[]}
        isSending={false}
        onSendMessage={vi.fn(async () => 'unused')}
        onClearHistory={vi.fn()}
        onStartScreenshot={onStartScreenshot}
      />,
    );

    await user.click(screen.getByRole('button', { name: '截图' }));
    expect(screen.getByRole('img', { name: '截图预览' })).toBeInTheDocument();

    const input = screen.getByPlaceholderText('问任何问题，@ 模型，/ 提示');
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(screen.queryByRole('img', { name: '截图预览' })).not.toBeInTheDocument();
  });

  it('sends a message with Command+Enter', async () => {
    const user = userEvent.setup();
    const messages: ChatMessage[] = [];

    const onSendMessage = vi.fn(async () => '你好，我是助手');

    render(
      <ChatPanel
        messages={messages}
        isSending={false}
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

    const { rerender } = render(<MessageList isSending={false} messages={messages} />);

    const list = screen.getByTestId('message-list');
    Object.defineProperty(list, 'scrollHeight', { value: 480, configurable: true });
    Object.defineProperty(list, 'scrollTop', { value: 0, writable: true, configurable: true });

    rerender(
      <MessageList
        isSending={false}
        messages={[...messages, { id: 'u1', role: 'user', content: 'second', createdAt: '10:31' }]}
      />,
    );

    expect(list.scrollTop).toBe(480);
  });
});
