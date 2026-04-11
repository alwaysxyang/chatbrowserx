import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { SpeechSettings, SourceLanguage, TargetLanguage } from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';

interface VoiceSettingsFormProps {
  value: SpeechSettings;
  disabled: boolean;
  onChange: (nextValue: SpeechSettings) => void;
}

export function VoiceSettingsForm({ value, disabled, onChange }: VoiceSettingsFormProps) {
  const [showSecretKey, setShowSecretKey] = useState(false);

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
          <option value="auto">{translateMessage('settings.voice.language.auto')}</option>
          <option value="zh">{translateMessage('settings.voice.language.zh')}</option>
          <option value="en">{translateMessage('settings.voice.language.en')}</option>
          <option value="ja">{translateMessage('settings.voice.language.ja')}</option>
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
          <option value="none">{translateMessage('settings.voice.language.none')}</option>
          <option value="zh">{translateMessage('settings.voice.language.zh')}</option>
          <option value="en">{translateMessage('settings.voice.language.en')}</option>
          <option value="ja">{translateMessage('settings.voice.language.ja')}</option>
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

      <label>
        <span>{translateMessage('settings.voice.secretAccessKey')}</span>
        <div className="settings-input-with-icon">
          <input
            aria-label={translateMessage('settings.voice.secretAccessKey')}
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
            aria-label={showSecretKey ? translateMessage('settings.apiKey.hide') : translateMessage('settings.apiKey.show')}
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
