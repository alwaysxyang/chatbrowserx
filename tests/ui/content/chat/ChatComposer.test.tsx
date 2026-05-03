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

/**
 * Renders ChatComposer with fresh paste-related callbacks.
 */
function renderPasteComposer(): {
  onAddImages: ReturnType<typeof vi.fn>;
  onChange: ReturnType<typeof vi.fn>;
  textarea: HTMLElement;
} {
  const onAddImages = vi.fn();
  const onChange = vi.fn();

  render(
    <ChatComposer
      {...defaultProps}
      onChange={onChange}
      onAddImages={onAddImages}
    />
  );

  return {
    onAddImages,
    onChange,
    textarea: screen.getByRole('textbox'),
  };
}

/**
 * Dispatches an HTML clipboard paste event to the composer textarea.
 */
function pasteHtml(textarea: HTMLElement, htmlContent: string): void {
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
}

describe('ChatComposer', () => {
  it('pastes images from HTML content', () => {
    const { onAddImages, onChange, textarea } = renderPasteComposer();
    const htmlContent = '<img src="data:image/png;base64,abc123" /><p>测试文字</p>';

    pasteHtml(textarea, htmlContent);

    expect(onAddImages).toHaveBeenCalledWith(['data:image/png;base64,abc123']);
    expect(onChange).toHaveBeenCalledWith('测试文字');
  });

  it('pastes multiple images from HTML content', () => {
    const { onAddImages, onChange, textarea } = renderPasteComposer();
    const htmlContent = `
      <img src="data:image/png;base64,abc123" />
      <img src="data:image/jpeg;base64,def456" />
      <p>比较这两张图片</p>
    `;

    pasteHtml(textarea, htmlContent);

    expect(onAddImages).toHaveBeenCalledWith([
      'data:image/png;base64,abc123',
      'data:image/jpeg;base64,def456',
    ]);
    expect(onChange).toHaveBeenCalledWith('比较这两张图片');
  });

  it('ignores non-data-url images in HTML', () => {
    const { onAddImages, textarea } = renderPasteComposer();
    const htmlContent = '<img src="https://example.com/image.png" /><p>外部图片</p>';

    pasteHtml(textarea, htmlContent);

    expect(onAddImages).not.toHaveBeenCalled();
  });

  it('allows default paste behavior when HTML has no images', () => {
    const { onAddImages, textarea } = renderPasteComposer();
    const htmlContent = '<p>纯文本内容</p>';

    pasteHtml(textarea, htmlContent);

    expect(onAddImages).not.toHaveBeenCalled();
  });
});
