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

  const handlePaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled) {
      return;
    }

    if (!event.clipboardData) {
      return;
    }

    // 首先尝试获取图片文件
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

    // 如果没有图片文件，尝试从 HTML 中提取图片
    const html = event.clipboardData.getData('text/html');
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img');

      if (images.length > 0) {
        event.preventDefault();

        // 提取所有图片的 data URL
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

        // 提取文本内容
        const textContent = doc.body.textContent?.trim();
        if (textContent) {
          // 将文本插入到当前光标位置
          const textarea = event.currentTarget;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = value.substring(0, start) + textContent + value.substring(end);
          onChange(newValue);

          // 设置光标位置到插入文本的末尾
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
