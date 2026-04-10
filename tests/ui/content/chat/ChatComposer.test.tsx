import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from '../../../../src/ui/content/chat/ChatComposer';

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  onAddImages: vi.fn(),
  onRemoveImage: vi.fn(),
  onClear: vi.fn(),
  onStop: vi.fn(),
  imageUrls: [],
  disabled: false,
  isSending: false,
};

describe('ChatComposer', () => {
  it('pastes images from HTML content', () => {
    const onAddImages = vi.fn();
    const onChange = vi.fn();

    render(
      <ChatComposer
        {...defaultProps}
        onChange={onChange}
        onAddImages={onAddImages}
      />
    );

    const textarea = screen.getByRole('textbox');

    // 模拟粘贴 HTML 内容（包含图片）
    const htmlContent = '<img src="data:image/png;base64,abc123" /><p>测试文字</p>';

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (format: string) => {
          if (format === 'text/html') return htmlContent;
          return '';
        },
        files: [],
        items: [],
        types: ['text/html'],
      },
    });

    expect(onAddImages).toHaveBeenCalledWith(['data:image/png;base64,abc123']);
    expect(onChange).toHaveBeenCalledWith('测试文字');
  });

  it('pastes multiple images from HTML content', () => {
    const onAddImages = vi.fn();
    const onChange = vi.fn();

    render(
      <ChatComposer
        {...defaultProps}
        onChange={onChange}
        onAddImages={onAddImages}
      />
    );

    const textarea = screen.getByRole('textbox');

    // 模拟粘贴包含多张图片的 HTML
    const htmlContent = `
      <img src="data:image/png;base64,abc123" />
      <img src="data:image/jpeg;base64,def456" />
      <p>比较这两张图片</p>
    `;

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (format: string) => {
          if (format === 'text/html') return htmlContent;
          return '';
        },
        files: [],
        items: [],
        types: ['text/html'],
      },
    });

    expect(onAddImages).toHaveBeenCalledWith([
      'data:image/png;base64,abc123',
      'data:image/jpeg;base64,def456',
    ]);
    expect(onChange).toHaveBeenCalledWith('比较这两张图片');
  });

  it('ignores non-data-url images in HTML', () => {
    const onAddImages = vi.fn();
    const onChange = vi.fn();

    render(
      <ChatComposer
        {...defaultProps}
        onChange={onChange}
        onAddImages={onAddImages}
      />
    );

    const textarea = screen.getByRole('textbox');

    // 模拟粘贴包含外部 URL 图片的 HTML
    const htmlContent = '<img src="https://example.com/image.png" /><p>外部图片</p>';

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (format: string) => {
          if (format === 'text/html') return htmlContent;
          return '';
        },
        files: [],
        items: [],
        types: ['text/html'],
      },
    });

    // 不应该添加外部 URL 的图片
    expect(onAddImages).not.toHaveBeenCalled();
  });

  it('allows default paste behavior when HTML has no images', () => {
    const onAddImages = vi.fn();
    const onChange = vi.fn();

    render(
      <ChatComposer
        {...defaultProps}
        onChange={onChange}
        onAddImages={onAddImages}
      />
    );

    const textarea = screen.getByRole('textbox');

    // 模拟粘贴纯文本 HTML（没有图片）
    const htmlContent = '<p>纯文本内容</p>';

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (format: string) => {
          if (format === 'text/html') return htmlContent;
          return '';
        },
        files: [],
        items: [],
        types: ['text/html'],
      },
    });

    // 不应该调用 onAddImages（因为没有图片）
    expect(onAddImages).not.toHaveBeenCalled();
  });
});
