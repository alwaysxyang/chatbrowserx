import { FormEvent, useEffect, useRef } from 'react';
import { ChatToolbar } from './ChatToolbar';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

export function ChatComposer({ value, disabled, onChange, onSubmit, onClear }: ChatComposerProps) {
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


  useEffect(() => {
    autoResize();
  }, [value]);

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
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
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.metaKey) {
            event.preventDefault();
            if (!disabled && value.trim()) {
              onSubmit();
            }
          }
        }}
      />

      <ChatToolbar disabled={disabled} canSend={!!value.trim()} onClear={onClear} />
    </form>
  );
}
