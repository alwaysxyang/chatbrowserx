import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ModelSettings } from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';
import {
  getActiveProviderFormValues,
  updateCodexSettings,
  updateOpenAiSettings,
  updateProvider,
  updateSharedModelSettings,
} from './model-settings-helpers';

interface ChatSettingsFormProps {
  value: ModelSettings;
  disabled: boolean;
  onChange: (nextValue: ModelSettings) => void;
}

export function ChatSettingsForm({ value, disabled, onChange }: ChatSettingsFormProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const activeProvider = getActiveProviderFormValues(value);
  const updateProviderConnection = (nextValue: Partial<ModelSettings['openai']> | Partial<ModelSettings['codex']>) => {
    if (activeProvider.isOpenAi) {
      onChange(updateOpenAiSettings(value, nextValue as Partial<ModelSettings['openai']>));
      return;
    }

    onChange(updateCodexSettings(value, nextValue as Partial<ModelSettings['codex']>));
  };

  return (
    <div className="settings-form">
      <span className="settings-provider-title">{translateMessage('settings.fields.provider')}</span>
      <div className="settings-provider-switch" aria-label={translateMessage('settings.provider.switchLabel')}>
        <button
          type="button"
          className={`settings-provider-button ${activeProvider.isOpenAi ? 'settings-provider-button-active' : ''}`}
          data-tooltip={translateMessage('settings.provider.openaiTooltip')}
          data-tooltip-placement="bottom"
          onClick={() => onChange(updateProvider(value, 'openai'))}
        >
          OpenAI
        </button>
        <button
          type="button"
          className={`settings-provider-button ${!activeProvider.isOpenAi ? 'settings-provider-button-active' : ''}`}
          data-tooltip={translateMessage('settings.provider.codexTooltip')}
          data-tooltip-placement="bottom"
          onClick={() => onChange(updateProvider(value, 'codex'))}
        >
          Codex
        </button>
      </div>

      <label>
        <span>{translateMessage('settings.fields.apiBaseUrl')}</span>
        <input
          aria-label={translateMessage('settings.fields.apiBaseUrl')}
          value={activeProvider.baseUrl}
          onChange={(event) => updateProviderConnection({ baseUrl: event.target.value })}
        />
      </label>

      <label>
        <span>
          {activeProvider.isOpenAi
            ? translateMessage('settings.fields.apiKey')
            : translateMessage('settings.codex.fields.accessToken')}
        </span>

        <div className="settings-input-with-icon">
          {activeProvider.isOpenAi ? (
            <input
              aria-label={translateMessage('settings.fields.apiKey')}
              type={showApiKey ? 'text' : 'password'}
              value={activeProvider.credential}
              onChange={(event) => onChange(updateOpenAiSettings(value, { apiKey: event.target.value }))}
            />
          ) : (
            <textarea
              aria-label={translateMessage('settings.codex.fields.accessToken')}
              rows={5}
              value={showApiKey ? activeProvider.credential : '•'.repeat(activeProvider.credential ? activeProvider.credential.length : 8)}
              onChange={
                showApiKey
                  ? (event) => onChange(updateCodexSettings(value, { accessToken: event.target.value }))
                  : undefined
              }
              readOnly={!showApiKey}
            />
          )}
          <button
            type="button"
            className="settings-input-icon-button"
            aria-label={showApiKey ? translateMessage('settings.apiKey.hide') : translateMessage('settings.apiKey.show')}
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
        <span>{translateMessage('settings.fields.model')}</span>
        <input
          aria-label={translateMessage('settings.fields.model')}
          value={activeProvider.model}
          onChange={(event) => updateProviderConnection({ model: event.target.value })}
        />
      </label>

      <label>
        <span>{translateMessage('settings.fields.systemPrompt')}</span>
        <textarea
          aria-label={translateMessage('settings.fields.systemPrompt')}
          rows={4}
          value={value.systemPrompt}
          onChange={(event) => onChange(updateSharedModelSettings(value, 'systemPrompt', event.target.value))}
        />
      </label>

      <label>
        <span>{translateMessage('settings.fields.maxHistory')}</span>
        <input
          aria-label={translateMessage('settings.fields.maxHistory')}
          min={1}
          type="number"
          value={value.maxHistory}
          onChange={(event) => onChange(updateSharedModelSettings(value, 'maxHistory', Number(event.target.value) || 1))}
        />
      </label>

      {/* 底部操作统一放在 SettingsPanel 的 footer，不在 tab 内 */}
    </div>
  );
}
