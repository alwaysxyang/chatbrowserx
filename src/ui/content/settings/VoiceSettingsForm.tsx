import {
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  type SpeechSettings,
  type SourceLanguage,
  type TargetLanguage,
} from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';
import { SecretField } from './SecretField';

interface VoiceSettingsFormProps {
  value: SpeechSettings;
  disabled: boolean;
  onChange: (nextValue: SpeechSettings) => void;
}

/**
 * Render speech provider credentials and language preferences.
 */
export function VoiceSettingsForm({ value, disabled, onChange }: VoiceSettingsFormProps) {
  return (
    <div className="settings-form">
      <span className="settings-provider-title">{translateMessage('settings.voice.provider')}</span>
      <div className="settings-provider-switch" aria-label={translateMessage('settings.voice.provider')}>
        <button
          type="button"
          className="settings-provider-button settings-provider-button-active"
          data-tooltip={translateMessage('settings.voice.provider.volcengine')}
          data-tooltip-placement="bottom"
          disabled={disabled}
        >
          Volcengine
        </button>
      </div>

      <label>
        <span>{translateMessage('settings.voice.sourceLanguage')}</span>
        <select
          aria-label={translateMessage('settings.voice.sourceLanguage')}
          value={value.sourceLanguage}
          onChange={(e) => onChange({ ...value, sourceLanguage: e.target.value as SourceLanguage })}
          disabled={disabled}
        >
          {SOURCE_LANGUAGE_OPTIONS.map((language) => (
            <option key={language} value={language}>
              {translateMessage(`settings.voice.language.${language}`)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>{translateMessage('settings.voice.targetLanguage')}</span>
        <select
          aria-label={translateMessage('settings.voice.targetLanguage')}
          value={value.targetLanguage}
          onChange={(e) => onChange({ ...value, targetLanguage: e.target.value as TargetLanguage })}
          disabled={disabled}
        >
          {TARGET_LANGUAGE_OPTIONS.map((language) => (
            <option key={language} value={language}>
              {translateMessage(`settings.voice.language.${language}`)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>{translateMessage('settings.voice.accessKeyId')}</span>
        <input
          aria-label={translateMessage('settings.voice.accessKeyId')}
          type="text"
          value={value.volcengine.accessKeyId}
          onChange={(e) =>
            onChange({
              ...value,
              volcengine: { ...value.volcengine, accessKeyId: e.target.value },
            })
          }
          disabled={disabled}
        />
      </label>

      <SecretField
        fieldDisabled={disabled}
        label={translateMessage('settings.voice.secretAccessKey')}
        toggleDisabled={disabled}
        value={value.volcengine.secretAccessKey}
        onChange={(nextSecretAccessKey) =>
          onChange({
            ...value,
            volcengine: { ...value.volcengine, secretAccessKey: nextSecretAccessKey },
          })
        }
      />
    </div>
  );
}
