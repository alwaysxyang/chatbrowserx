import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { translateMessage } from '../../../shared/i18n/i18n';

interface SecretFieldProps {
  label: string;
  value: string;
  toggleDisabled: boolean;
  fieldDisabled?: boolean;
  multiline?: boolean;
  rows?: number;
  onChange: (nextValue: string) => void;
}

/**
 * Render a credential field with local show/hide state and consistent masking behavior.
 */
export function SecretField({
  label,
  value,
  toggleDisabled,
  fieldDisabled = false,
  multiline = false,
  rows = 5,
  onChange,
}: SecretFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityLabel = isVisible ? translateMessage('settings.apiKey.hide') : translateMessage('settings.apiKey.show');

  return (
    <label>
      <span>{label}</span>
      <div className="settings-input-with-icon">
        {multiline ? (
          <textarea
            aria-label={label}
            rows={rows}
            value={isVisible ? value : '•'.repeat(value ? value.length : 8)}
            onChange={isVisible ? (event) => onChange(event.target.value) : undefined}
            readOnly={!isVisible}
            disabled={fieldDisabled}
          />
        ) : (
          <input
            aria-label={label}
            type={isVisible ? 'text' : 'password'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={fieldDisabled}
          />
        )}
        <button
          type="button"
          className="settings-input-icon-button"
          aria-label={visibilityLabel}
          onClick={() => setIsVisible((current) => !current)}
          disabled={toggleDisabled}
        >
          {isVisible ? (
            <EyeOff className="settings-input-icon" strokeWidth={2.1} />
          ) : (
            <Eye className="settings-input-icon" strokeWidth={2.1} />
          )}
        </button>
      </div>
    </label>
  );
}
