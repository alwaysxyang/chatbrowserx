import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ChatProviderId, ModelSettings } from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatSettingsFormProps {
  value: ModelSettings;
  disabled: boolean;
  onChange: (nextValue: ModelSettings) => void;
}

export function ChatSettingsForm({ value, disabled, onChange }: ChatSettingsFormProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const updateField = <K extends keyof ModelSettings>(field: K, nextValue: ModelSettings[K]) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  const label = (key: Parameters<typeof translateMessage>[0]) => translateMessage(key);

  return (
    <div className="settings-form">
      <span className="settings-provider-title">{label('settings.fields.provider')}</span>
      <div className="settings-provider-switch" aria-label={label('settings.provider.switchLabel')}>
        <button
          type="button"
          className={`settings-provider-button ${
            value.provider === 'openai' ? 'settings-provider-button-active' : ''
          }`}
          data-tooltip={label('settings.provider.openaiTooltip')}
          onClick={() => updateField('provider', 'openai' satisfies ChatProviderId)}
        >
          OpenAI
        </button>
        <button
          type="button"
          className={`settings-provider-button ${
            value.provider === 'codex' ? 'settings-provider-button-active' : ''
          }`}
          data-tooltip={label('settings.provider.codexTooltip')}
          onClick={() => updateField('provider', 'codex' satisfies ChatProviderId)}
        >
          Codex
        </button>
      </div>

      <label>
        <span>{label('settings.fields.apiBaseUrl')}</span>
        <input
          aria-label={label('settings.fields.apiBaseUrl')}
          value={value.provider === 'openai' ? value.openai.baseUrl : value.codex.baseUrl}
          onChange={(event) => {
            const next = event.target.value;
            if (value.provider === 'openai') {
              onChange({
                ...value,
                openai: { ...value.openai, baseUrl: next },
              });
            } else {
              onChange({
                ...value,
                codex: { ...value.codex, baseUrl: next },
              });
            }
          }}
        />
      </label>

      <label>
        <span>
          {value.provider === 'openai'
            ? label('settings.fields.apiKey')
            : label('settings.codex.fields.accessToken')}
        </span>

        <div className="settings-input-with-icon">
          {value.provider === 'openai' ? (
            <input
              aria-label={label('settings.fields.apiKey')}
              type={showApiKey ? 'text' : 'password'}
              value={value.openai.apiKey}
              onChange={(event) =>
                onChange({ ...value, openai: { ...value.openai, apiKey: event.target.value } })
              }
            />
          ) : (
            <textarea
              aria-label={label('settings.codex.fields.accessToken')}
              rows={5}
              value={
                showApiKey
                  ? value.codex.accessToken
                  : '•'.repeat(value.codex.accessToken ? value.codex.accessToken.length : 8)
              }
              onChange={
                showApiKey
                  ? (event) =>
                      onChange({
                        ...value,
                        codex: { ...value.codex, accessToken: event.target.value },
                      })
                  : undefined
              }
              readOnly={!showApiKey}
            />
          )}
          <button
            type="button"
            className="settings-input-icon-button"
            aria-label={showApiKey ? label('settings.apiKey.hide') : label('settings.apiKey.show')}
            onClick={() => setShowApiKey((current) => !current)}
            disabled={disabled}
          >
            {showApiKey ? (
              <EyeOff className="settings-input-icon" strokeWidth={2.1} />
            ) : (
              <Eye className="settings-input-icon" strokeWidth={2.1} />
            )}
          </button>
        </div>
      </label>
      <label>
        <span>{label('settings.fields.model')}</span>
        <input
          aria-label={label('settings.fields.model')}
          value={value.provider === 'openai' ? value.openai.model : value.codex.model}
          onChange={(event) =>
            value.provider === 'openai'
              ? onChange({ ...value, openai: { ...value.openai, model: event.target.value } })
              : onChange({ ...value, codex: { ...value.codex, model: event.target.value } })
          }
        />
      </label>

      <label>
        <span>{label('settings.fields.systemPrompt')}</span>
        <textarea
          aria-label={label('settings.fields.systemPrompt')}
          rows={4}
          value={value.systemPrompt}
          onChange={(event) => updateField('systemPrompt', event.target.value)}
        />
      </label>

      <label>
        <span>{label('settings.fields.maxHistory')}</span>
        <input
          aria-label={label('settings.fields.maxHistory')}
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
