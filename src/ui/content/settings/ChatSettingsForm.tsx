import type { ChatSettings } from '../../../shared/types/settings';

interface ChatSettingsFormProps {
  value: ChatSettings;
  disabled: boolean;
  onChange: (nextValue: ChatSettings) => void;
  onSubmit: () => void;
}

export function ChatSettingsForm({ value, disabled, onChange, onSubmit }: ChatSettingsFormProps) {
  const updateField = <K extends keyof ChatSettings>(field: K, nextValue: ChatSettings[K]) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  return (
    <div className="settings-form">
      <label>
        <span>API Base URL</span>
        <input aria-label="API Base URL" value={value.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} />
      </label>

      <label>
        <span>API Key</span>
        <input aria-label="API Key" type="password" value={value.apiKey} onChange={(event) => updateField('apiKey', event.target.value)} />
      </label>

      <label>
        <span>Model</span>
        <input aria-label="Model" value={value.model} onChange={(event) => updateField('model', event.target.value)} />
      </label>

      <label>
        <span>System Prompt</span>
        <textarea aria-label="System Prompt" rows={4} value={value.systemPrompt} onChange={(event) => updateField('systemPrompt', event.target.value)} />
      </label>

      <label>
        <span>Max History</span>
        <input
          aria-label="Max History"
          min={1}
          type="number"
          value={value.maxHistory}
          onChange={(event) => updateField('maxHistory', Number(event.target.value) || 1)}
        />
      </label>

      <button
        className="primary-button"
        data-tooltip={disabled ? '填写完整后可保存' : '保存聊天设置'}
        disabled={disabled}
        type="button"
        onClick={onSubmit}
      >
        保存设置
      </button>
    </div>
  );
}
