import { FormEvent, type ClipboardEvent as ReactClipboardEvent, useEffect, useRef } from 'react';
import { ChatToolbar } from './ChatToolbar';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  screenshotUrls: string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onRemoveScreenshot: (index: number) => void;
  onAddScreenshots: (dataUrls: string[]) => void;
  isSending: boolean;
  onStop: () => void;
  onScreenshot?: () => void;
  onPreviewImage?: (src: string) => void;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Pasted image could not be read as a data URL.'));
    };
    reader.onerror = () => reject(new Error('Pasted image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function getPastedImageFiles(clipboardData: DataTransfer): File[] {
  const itemFiles = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File);

  if (itemFiles.length) {
    return itemFiles;
  }

  return Array.from(clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));
}

export function ChatComposer({
  value,
  disabled,
  screenshotUrls,
  onChange,
  onSubmit,
  onClear,
  onRemoveScreenshot,
  onAddScreenshots,
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

    const imageFiles = getPastedImageFiles(event.clipboardData);

    if (!imageFiles.length) {
      return;
    }

    event.preventDefault();
    void Promise.all(imageFiles.map(readImageAsDataUrl)).then((dataUrls) => {
      onAddScreenshots(dataUrls);
    }).catch(() => {});
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      {screenshotUrls.length ? (
        <div className="chat-screenshot-preview-list">
          {screenshotUrls.map((screenshotUrl, index) => (
            <div className="chat-screenshot-preview" key={`${screenshotUrl}-${index}`}>
              <img
                className="chat-screenshot-preview-image"
                src={screenshotUrl}
                alt={translateMessage('chat.screenshot.previewAlt')}
                onDoubleClick={() => {
                  onPreviewImage?.(screenshotUrl);
                }}
              />
              <button
                className="chat-screenshot-remove"
                type="button"
                aria-label={translateMessage('chat.screenshot.remove')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onRemoveScreenshot(index)}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

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
          if ((event.key === 'Backspace' || event.key === 'Delete') && !value && screenshotUrls.length) {
            event.preventDefault();
            onRemoveScreenshot(screenshotUrls.length - 1);
            return;
          }

          if (event.key === 'Enter' && event.metaKey) {
            event.preventDefault();
            if (!disabled && (value.trim() || screenshotUrls.length)) {
              onSubmit();
            }
          }
        }}
      />

      <ChatToolbar
        disabled={disabled}
        canSend={!!value.trim() || screenshotUrls.length > 0}
        isSending={isSending}
        onClear={onClear}
        onStop={onStop}
        onScreenshot={onScreenshot}
      />
    </form>
  );
}
