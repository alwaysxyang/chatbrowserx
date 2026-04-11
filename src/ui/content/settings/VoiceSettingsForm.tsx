import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { SpeechSettings, SourceLanguage, TargetLanguage } from '../../../shared/types/speech';
import { translateMessage } from '../../../shared/i18n/i18n';

interface VoiceSettingsFormProps {
  value: SpeechSettings;
  disabled: boolean;
  onChange: (nextValue: SpeechSettings) => void;
}

export function VoiceSettingsForm({ value, disabled, onChange }: VoiceSettingsFormProps) {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const label = (key: Parameters<typeof translateMessage>[0]) => translateMessage(key);

  return (
    <div className="settings-form">
      <span className="settings-provider-title">{label('settings.voice.provider')}</span>
      <div className="settings-provider-switch" aria-label={label('settings.voice.provider')}>
        <button
          type="button"
          className="settings-provider-button settings-provider-button-active"
          data-tooltip={label('settings.voice.provider.volcengine')}
          data-tooltip-placement="bottom"
          disabled={disabled}
        >
          Volcengine
        </button>
      </div>

      <label>
        <span>{label('settings.voice.sourceLanguage')}</span>
        <select
          aria-label={label('settings.voice.sourceLanguage')}
          value={value.sourceLanguage}
          onChange={(e) => onChange({ ...value, sourceLanguage: e.target.value as SourceLanguage })}
          disabled={disabled}
        >
          <option value="auto">{label('settings.voice.language.auto')}</option>
          <option value="zh">{label('settings.voice.language.zh')}</option>
          <option value="en">{label('settings.voice.language.en')}</option>
          <option value="ja">{label('settings.voice.language.ja')}</option>
        </select>
      </label>

      <label>
        <span>{label('settings.voice.targetLanguage')}</span>
        <select
          aria-label={label('settings.voice.targetLanguage')}
          value={value.targetLanguage}
          onChange={(e) => onChange({ ...value, targetLanguage: e.target.value as TargetLanguage })}
          disabled={disabled}
        >
          <option value="none">{label('settings.voice.language.none')}</option>
          <option value="zh">{label('settings.voice.language.zh')}</option>
          <option value="en">{label('settings.voice.language.en')}</option>
          <option value="ja">{label('settings.voice.language.ja')}</option>
        </select>
      </label>

      <label>
        <span>{label('settings.voice.accessKeyId')}</span>
        <input
          aria-label={label('settings.voice.accessKeyId')}
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

      <label>
        <span>{label('settings.voice.secretAccessKey')}</span>
        <div className="settings-input-with-icon">
          <input
            aria-label={label('settings.voice.secretAccessKey')}
            type={showSecretKey ? 'text' : 'password'}
            value={value.volcengine.secretAccessKey}
            onChange={(e) =>
              onChange({
                ...value,
                volcengine: { ...value.volcengine, secretAccessKey: e.target.value },
              })
            }
            disabled={disabled}
          />
          <button
            type="button"
            className="settings-input-icon-button"
            aria-label={showSecretKey ? label('settings.apiKey.hide') : label('settings.apiKey.show')}
            onClick={() => setShowSecretKey((current) => !current)}
            disabled={disabled}
          >
            {showSecretKey ? (
              <EyeOff className="settings-input-icon" strokeWidth={2.1} />
            ) : (
              <Eye className="settings-input-icon" strokeWidth={2.1} />
            )}
          </button>
        </div>
      </label>
    </div>
  );
}
