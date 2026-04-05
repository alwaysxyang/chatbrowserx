import { useEffect, useRef, useState } from 'react';
import { defaultSettings, loadSettings, saveSettings } from '../../../shared/storage/settings-repository';
import type { ModelSettings, Settings, UiLanguage } from '../../../shared/types/settings';
import { translateMessage } from '../../../shared/i18n/i18n';
import { ChatSettingsForm } from './ChatSettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';

interface SettingsPanelProps {
  onUiLanguageChange?: (next: UiLanguage) => void;
}

export function SettingsPanel({ onUiLanguageChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const hasUserInteractedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'model' | 'general'>('model');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((storedSettings) => {
      if (!hasUserInteractedRef.current) {
        setSettings(storedSettings);
      }
    });
  }, []);
  const handleSave = async () => {
    setIsSaving(true);
    setSaveToast(null);

    try {
      // 先等待一小段时间，再真实保存，给用户一个“保存中”的感受
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await saveSettings(settings);

      // Toast 使用本次保存后的语言设置，避免总是滞后一轮
      const toastLanguage = settings.general.uiLanguage;
      setSaveToast(translateMessage('settings.toast.saved', toastLanguage));

      // 仅在保存成功后，才将语言变更同步给上层（ContentApp），从而更新全局 UI 语言
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

  // 保存成功提示 1.5s 后自动消失
  useEffect(() => {
    if (!saveToast) return;

    const timer = window.setTimeout(() => {
      setSaveToast(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [saveToast]);

  return (
    <section className="settings-page">
      {(() => {
        const label = (key: Parameters<typeof translateMessage>[0]) => translateMessage(key);

        return (
          <>
            <nav aria-label={label('settings.tabs.navLabel')} className="settings-tabs">
              <button
                className={`settings-tab ${activeTab === 'model' ? 'settings-tab-active' : ''}`}
                type="button"
                onClick={() => setActiveTab('model')}
              >
                {label('settings.tabs.model')}
              </button>
              <button
                className={`settings-tab ${activeTab === 'general' ? 'settings-tab-active' : ''}`}
                type="button"
                onClick={() => setActiveTab('general')}
              >
                {label('settings.tabs.general')}
              </button>
            </nav>

            {saveToast ? (
              <div className="settings-toast" role="status" aria-live="polite">
                {saveToast}
              </div>
            ) : null}

            {activeTab === 'model' ? (
              <ChatSettingsForm
                disabled={isSaving}
                value={settings.model}
                onChange={(nextModelSettings: ModelSettings) => {
                  hasUserInteractedRef.current = true;
                  setSettings((prev) => ({ ...prev, model: nextModelSettings }));
                }}
              />
            ) : (
              <GeneralSettingsForm
                disabled={isSaving}
                value={settings.general}
                onChange={(nextGeneralSettings) => {
                  hasUserInteractedRef.current = true;
                  setSettings((prev) => ({ ...prev, general: nextGeneralSettings }));
                }}
              />
            )}

            <footer className="settings-footer">
              <button
                className="primary-button"
                data-tooltip={isSaving ? label('settings.actions.saving') : label('settings.actions.save')}
                disabled={isSaving}
                type="button"
                onClick={handleSave}
              >
                {isSaving ? label('settings.actions.saving') : label('settings.actions.save')}
              </button>
              <button
                className="secondary-button"
                data-tooltip={label('settings.actions.reset')}
                type="button"
                onClick={handleResetToDefault}
              >
                {label('settings.actions.reset')}
              </button>
            </footer>
          </>
        );
      })()}
    </section>
  );
}
