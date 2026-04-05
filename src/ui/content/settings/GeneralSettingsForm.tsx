import type { GeneralSettings } from '../../../shared/types/settings';

interface GeneralSettingsFormProps {
  value: GeneralSettings;
  disabled: boolean;
  onChange: (nextValue: GeneralSettings) => void;
}

export function GeneralSettingsForm({ value, disabled, onChange }: GeneralSettingsFormProps) {
  return (
    <div className="settings-form">
      <label>
        <span>语言</span>
        <div className="settings-select">
          <select
            aria-label="语言"
            disabled={disabled}
            value={value.uiLanguage}
            onChange={(event) =>
              onChange({
                uiLanguage: event.target.value as GeneralSettings['uiLanguage'],
              })
            }
          >
            <option value="system">跟随系统</option>
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="ja">日文</option>
          </select>
        </div>
      </label>
    </div>
  );
}
