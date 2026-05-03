import { FormEvent, type ClipboardEvent as ReactClipboardEvent, useEffect, useRef } from 'react';
import { ChatToolbar } from './ChatToolbar';
import { ChatImageList } from './ChatImageList';
import { getClipboardImageFiles, readClipboardImagesAsDataUrls } from './clipboard/image-clipboard';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  imageUrls: string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onRemoveImage: (index: number) => void;
  onAddImages: (dataUrls: string[]) => void;
  isSending: boolean;
  onStop: () => void;
  onScreenshot?: () => void;
  onPreviewImage?: (src: string) => void;
}

/**
 * Renders the chat composer with text input, image paste handling, and command shortcuts.
 */
export function ChatComposer({
  value,
  disabled,
  imageUrls,
  onChange,
  onSubmit,
  onClear,
  onRemoveImage,
  onAddImages,
  isSending,
  onStop,
  onScreenshot,
  onPreviewImage,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Resizes the textarea to fit current text up to a bounded height.
   */
  const autoResize = () => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = 'auto';

    if (!element.value.trim()) {
      element.style.height = '';
      return;
    }

    const computed = window.getComputedStyle(element);
    const lineHeight = parseFloat(computed.lineHeight || '0') || 20;
    const maxHeight = lineHeight * 10;
    const nextHeight = Math.min(element.scrollHeight, maxHeight);

    element.style.height = `${Math.max(lineHeight * 1.4, nextHeight)}px`;
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  /**
   * Handles clipboard images, HTML image data URLs, and pasted HTML text.
   */
  const handlePaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled) {
      return;
    }

    if (!event.clipboardData) {
      return;
    }

    const imageFiles = getClipboardImageFiles(event.clipboardData);
    if (imageFiles.length) {
      event.preventDefault();
      void readClipboardImagesAsDataUrls(event.clipboardData)
        .then((dataUrls) => {
          onAddImages(dataUrls);
        })
        .catch(() => {});
      return;
    }

    const html = event.clipboardData.getData('text/html');
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img');

      if (images.length > 0) {
        event.preventDefault();

        const dataUrls: string[] = [];
        images.forEach((img) => {
          const src = img.getAttribute('src');
          if (src && src.startsWith('data:image/')) {
            dataUrls.push(src);
          }
        });

        if (dataUrls.length > 0) {
          onAddImages(dataUrls);
        }

        const textContent = doc.body.textContent?.trim();
        if (textContent) {
          const textarea = event.currentTarget;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = value.substring(0, start) + textContent + value.substring(end);
          onChange(newValue);

          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + textContent.length;
          }, 0);
        }
      }
    }
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <ChatImageList
        imageUrls={imageUrls}
        disabled={disabled}
        onRemoveImage={onRemoveImage}
        onPreviewImage={onPreviewImage}
      />

      <textarea
        aria-label={translateMessage('chat.composer.placeholder')}
        className="chat-input"
        disabled={disabled}
        placeholder={translateMessage('chat.composer.placeholder')}
        rows={1}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          autoResize();
        }}
        onPaste={handlePaste}
        onKeyDown={(event) => {
          if ((event.key === 'Backspace' || event.key === 'Delete') && !value && imageUrls.length) {
            event.preventDefault();
            onRemoveImage(imageUrls.length - 1);
            return;
          }

          if (event.key === 'Enter' && event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            if (!disabled && (value.trim() || imageUrls.length)) {
              onSubmit();
            }
          }
        }}
      />

      <ChatToolbar
        disabled={disabled}
        canSend={!!value.trim() || imageUrls.length > 0}
        isSending={isSending}
        onClear={onClear}
        onStop={onStop}
        onScreenshot={onScreenshot}
      />
    </form>
  );
}
