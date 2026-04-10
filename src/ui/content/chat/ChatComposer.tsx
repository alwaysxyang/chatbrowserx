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

    const imageFiles = getClipboardImageFiles(event.clipboardData);
    if (!imageFiles.length) {
      return;
    }

    event.preventDefault();
    void readClipboardImagesAsDataUrls(event.clipboardData)
      .then((dataUrls) => {
        onAddImages(dataUrls);
      })
      .catch(() => {});
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
