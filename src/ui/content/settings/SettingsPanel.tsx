import { useEffect, useRef, useState } from 'react';
import { defaultSettings, loadSettings, saveSettings } from '../../../shared/storage/settings-repository';
import type { ModelSettings, Settings, UiLanguage } from '../../../shared/types/settings';
import type { SpeechSettings } from '../../../shared/types/speech';
import { translateMessage } from '../../../shared/i18n/i18n';
import { ChatSettingsForm } from './ChatSettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { VoiceSettingsForm } from './VoiceSettingsForm';

interface SettingsPanelProps {
  onUiLanguageChange?: (next: UiLanguage) => void;
}

export function SettingsPanel({ onUiLanguageChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const hasUserInteractedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'model' | 'general' | 'voice'>('model');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((storedSettings) => {
      if (!hasUserInteractedRef.current) {
        setSettings(storedSettings);
      }
    });
  }, []);

  const updateSettings = (updater: (current: Settings) => Settings) => {
    hasUserInteractedRef.current = true;
    setSettings((current) => updater(current));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveToast(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await saveSettings(settings);

      const toastLanguage = settings.general.uiLanguage;
      setSaveToast(translateMessage('settings.toast.saved', toastLanguage));

      onUiLanguageChange?.(settings.general.uiLanguage);
    } catch (error) {
      const toastLanguage = settings.general.uiLanguage;
      const fallback = translateMessage('settings.toast.saveFailed', toastLanguage);
      const message = error instanceof Error ? error.message || fallback : fallback;
      setSaveToast(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    hasUserInteractedRef.current = true;
    setSettings(defaultSettings);
  };

  useEffect(() => {
    if (!saveToast) return;

    const timer = window.setTimeout(() => {
      setSaveToast(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [saveToast]);

  return (
    <section className="settings-page">
      <nav aria-label={translateMessage('settings.tabs.navLabel')} className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'model' ? 'settings-tab-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('model')}
        >
          {translateMessage('settings.tabs.model')}
        </button>
        <button
          className={`settings-tab ${activeTab === 'voice' ? 'settings-tab-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('voice')}
        >
          {translateMessage('settings.tabs.voice')}
        </button>
        <button
          className={`settings-tab ${activeTab === 'general' ? 'settings-tab-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('general')}
        >
          {translateMessage('settings.tabs.general')}
        </button>
      </nav>

      {saveToast ? (
        <div className="settings-toast" role="status" aria-live="polite">
          {saveToast}
        </div>
      ) : null}

      <div className="settings-body">
        {activeTab === 'model' ? (
          <ChatSettingsForm
            disabled={isSaving}
            value={settings.model}
            onChange={(nextModelSettings: ModelSettings) => {
              updateSettings((current) => ({ ...current, model: nextModelSettings }));
            }}
          />
        ) : activeTab === 'voice' ? (
          <VoiceSettingsForm
            disabled={isSaving}
            value={settings.speech}
            onChange={(nextSpeechSettings: SpeechSettings) => {
              updateSettings((current) => ({ ...current, speech: nextSpeechSettings }));
            }}
          />
        ) : (
          <GeneralSettingsForm
            disabled={isSaving}
            value={settings.general}
            onChange={(nextGeneralSettings) => {
              updateSettings((current) => ({ ...current, general: nextGeneralSettings }));
            }}
          />
        )}
      </div>

      <footer className="settings-footer">
        <button
          className="primary-button"
          data-tooltip={isSaving ? translateMessage('settings.actions.saving') : translateMessage('settings.actions.save')}
          disabled={isSaving}
          type="button"
          onClick={handleSave}
        >
          {isSaving ? translateMessage('settings.actions.saving') : translateMessage('settings.actions.save')}
        </button>
        <button
          className="secondary-button"
          data-tooltip={translateMessage('settings.actions.reset')}
          type="button"
          onClick={handleResetToDefault}
        >
          {translateMessage('settings.actions.reset')}
        </button>
      </footer>
    </section>
  );
}
