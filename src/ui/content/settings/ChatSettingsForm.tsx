import { CODEX_REASONING_EFFORT_OPTIONS, type ModelSettings } from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';
import {
  getActiveProviderFormValues,
  updateActiveProviderConnection,
  updateCodexSettings,
  updateOpenAiSettings,
  updateProvider,
  updateSharedModelSettings,
} from './model-settings-helpers';
import { SecretField } from './SecretField';

interface ChatSettingsFormProps {
  value: ModelSettings;
  disabled: boolean;
  onChange: (nextValue: ModelSettings) => void;
}

/**
 * Render the model settings form for provider credentials and shared model configuration.
 */
export function ChatSettingsForm({ value, disabled, onChange }: ChatSettingsFormProps) {
  const activeProvider = getActiveProviderFormValues(value);

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
          onChange={(event) => onChange(updateActiveProviderConnection(value, { baseUrl: event.target.value }))}
        />
      </label>

      <SecretField
        label={
          activeProvider.isOpenAi
            ? translateMessage('settings.fields.apiKey')
            : translateMessage('settings.codex.fields.accessToken')
        }
        multiline={!activeProvider.isOpenAi}
        toggleDisabled={disabled}
        value={activeProvider.credential}
        onChange={(nextCredential) =>
          activeProvider.isOpenAi
            ? onChange(updateOpenAiSettings(value, { apiKey: nextCredential }))
            : onChange(updateCodexSettings(value, { accessToken: nextCredential }))
        }
      />

      <SecretField
        label={translateMessage('settings.fields.tavilyApiKey')}
        toggleDisabled={disabled}
        value={value.tavilyApiKey}
        onChange={(nextApiKey) => onChange(updateSharedModelSettings(value, 'tavilyApiKey', nextApiKey))}
      />
      <label>
        <span>{translateMessage('settings.fields.model')}</span>
        <input
          aria-label={translateMessage('settings.fields.model')}
          value={activeProvider.model}
          onChange={(event) => onChange(updateActiveProviderConnection(value, { model: event.target.value }))}
        />
      </label>

      {!activeProvider.isOpenAi ? (
        <label>
          <span>{translateMessage('settings.codex.fields.effort')}</span>
          <select
            aria-label={translateMessage('settings.codex.fields.effort')}
            value={value.codex.effort}
            onChange={(event) =>
              onChange(updateCodexSettings(value, { effort: event.target.value as ModelSettings['codex']['effort'] }))
            }
          >
            {CODEX_REASONING_EFFORT_OPTIONS.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
    </div>
  );
}
