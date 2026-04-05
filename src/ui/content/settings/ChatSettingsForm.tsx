import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ChatProviderId, ChatSettings } from '../../../shared/types/settings';

interface ChatSettingsFormProps {
  value: ChatSettings;
  disabled: boolean;
  onChange: (nextValue: ChatSettings) => void;
}

export function ChatSettingsForm({ value, disabled, onChange }: ChatSettingsFormProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const updateField = <K extends keyof ChatSettings>(field: K, nextValue: ChatSettings[K]) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  return (
    <div className="settings-form">
      <span className="settings-provider-title">Provider</span>
      <div className="settings-provider-switch" aria-label="模型 Provider">
        <button
          type="button"
          className={`settings-provider-button ${value.provider === 'openai' ? 'settings-provider-button-active' : ''}`}
          data-tooltip="使用 OpenAI 兼容接口"
          onClick={() => updateField('provider', 'openai' satisfies ChatProviderId)}
        >
          OpenAI
        </button>
        <button
          type="button"
          className="settings-provider-button"
          data-tooltip="Codex（开发中）"
          disabled
        >
          Codex
        </button>
      </div>

      <label>
        <span>API Base URL</span>
        <input aria-label="API Base URL" value={value.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} />
      </label>

      <label>
        <span>API Key</span>
        <div className="settings-input-with-icon">
          <input
            aria-label="API Key"
            type={showApiKey ? 'text' : 'password'}
            value={value.apiKey}
            onChange={(event) => updateField('apiKey', event.target.value)}
          />
          <button
            type="button"
            className="settings-input-icon-button"
            data-tooltip={showApiKey ? '隐藏 API Key' : '显示 API Key'}
            onClick={() => setShowApiKey((current) => !current)}
          >
            {showApiKey ? <EyeOff className="settings-input-icon" strokeWidth={2.1} /> : <Eye className="settings-input-icon" strokeWidth={2.1} />}
          </button>
        </div>
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

      {/* 底部操作统一放在 SettingsPanel 的 footer，不在 tab 内 */}
    </div>
  );
}
