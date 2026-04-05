import type { GeneralSettings } from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';

interface GeneralSettingsFormProps {
  value: GeneralSettings;
  disabled: boolean;
  onChange: (nextValue: GeneralSettings) => void;
}

export function GeneralSettingsForm({ value, disabled, onChange }: GeneralSettingsFormProps) {
  return (
    <div className="settings-form">
      <label>
        <span>{translateMessage('settings.fields.language')}</span>
        <div className="settings-select">
          <select
            aria-label={translateMessage('settings.fields.language')}
            disabled={disabled}
            value={value.uiLanguage}
            onChange={(event) =>
              onChange({
                uiLanguage: event.target.value as GeneralSettings['uiLanguage'],
              })
            }
          >
            <option value="system">{translateMessage('settings.language.system')}</option>
            <option value="zh">{translateMessage('settings.language.zh')}</option>
            <option value="en">{translateMessage('settings.language.en')}</option>
            <option value="ja">{translateMessage('settings.language.ja')}</option>
          </select>
        </div>
      </label>
    </div>
  );
}
