import { useState, useEffect } from 'react';
import type { SpeechSettings, SourceLanguage, TargetLanguage } from '../../../shared/types/speech';
import { loadSpeechSettings, saveSpeechSettings } from '../../../shared/storage/speech-settings-repository';
import { translateMessage } from '../../../shared/i18n/i18n';

export function VoiceSettingsForm() {
  const [settings, setSettings] = useState<SpeechSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSpeechSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      await saveSpeechSettings(settings);
    } catch (error) {
      console.error('Failed to save speech settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return <div>Loading...</div>;
  }

  return (
    <div className="settings-form">
      <div className="settings-form__field">
        <label htmlFor="sourceLanguage" className="settings-form__label">
          {translateMessage('settings.voice.sourceLanguage')}
        </label>
        <select
          id="sourceLanguage"
          className="settings-form__select"
          value={settings.sourceLanguage}
          onChange={(e) =>
            setSettings({ ...settings, sourceLanguage: e.target.value as SourceLanguage })
          }
        >
          <option value="auto">{translateMessage('settings.voice.language.auto')}</option>
          <option value="zh">{translateMessage('settings.voice.language.zh')}</option>
          <option value="en">{translateMessage('settings.voice.language.en')}</option>
          <option value="ja">{translateMessage('settings.voice.language.ja')}</option>
        </select>
      </div>

      <div className="settings-form__field">
        <label htmlFor="targetLanguage" className="settings-form__label">
          {translateMessage('settings.voice.targetLanguage')}
        </label>
        <select
          id="targetLanguage"
          className="settings-form__select"
          value={settings.targetLanguage}
          onChange={(e) =>
            setSettings({ ...settings, targetLanguage: e.target.value as TargetLanguage })
          }
        >
          <option value="none">{translateMessage('settings.voice.language.none')}</option>
          <option value="zh">{translateMessage('settings.voice.language.zh')}</option>
          <option value="en">{translateMessage('settings.voice.language.en')}</option>
          <option value="ja">{translateMessage('settings.voice.language.ja')}</option>
        </select>
      </div>

      <div className="settings-form__field">
        <label htmlFor="appKey" className="settings-form__label">
          {translateMessage('settings.voice.appKey')}
        </label>
        <input
          id="appKey"
          type="text"
          className="settings-form__input"
          value={settings.volcengine.appKey}
          onChange={(e) =>
            setSettings({
              ...settings,
              volcengine: { ...settings.volcengine, appKey: e.target.value },
            })
          }
        />
      </div>

      <div className="settings-form__field">
        <label htmlFor="accessKey" className="settings-form__label">
          {translateMessage('settings.voice.accessKey')}
        </label>
        <input
          id="accessKey"
          type="password"
          className="settings-form__input"
          value={settings.volcengine.accessKey}
          onChange={(e) =>
            setSettings({
              ...settings,
              volcengine: { ...settings.volcengine, accessKey: e.target.value },
            })
          }
        />
      </div>

      <div className="settings-form__actions">
        <button
          className="settings-form__button settings-form__button--primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? translateMessage('settings.actions.saving') : translateMessage('settings.actions.save')}
        </button>
      </div>
    </div>
  );
}
