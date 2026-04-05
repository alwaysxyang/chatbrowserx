import { FormEvent } from 'react';

interface ChatComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({ value, disabled, onChange, onSubmit }: ChatComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <textarea
        aria-label="消息输入框"
        className="chat-input"
        disabled={disabled}
        placeholder="问任何问题，@ 模型，/ 提示"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="composer-footer">
        <button className="primary-button" disabled={disabled || !value.trim()} type="submit">
          发送
        </button>
      </div>
    </form>
  );
}
