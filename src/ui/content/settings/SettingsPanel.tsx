import { useEffect, useRef, useState } from 'react';
import { defaultSettings, loadSettings, saveSettings } from '../../../shared/storage/settings-repository';
import type { ChatSettings } from '../../../shared/types/settings';
import { ChatSettingsForm } from './ChatSettingsForm';

interface SettingsPanelProps {
}

export function SettingsPanel(_props: SettingsPanelProps) {
  const [settings, setSettings] = useState<ChatSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    loadSettings().then((storedSettings) => {
      if (!hasUserInteractedRef.current) {
        setSettings(storedSettings);
      }
    });
  }, []);

  const handleSettingsChange = (nextSettings: ChatSettings) => {
    hasUserInteractedRef.current = true;
    setSettings(nextSettings);
  };

  const handleSave = async () => {
    if (!settings.baseUrl.trim() || !settings.model.trim()) {
      setFeedbackMessage('请先填写 API Base URL 与 Model。');
      return;
    }

    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      await saveSettings(settings);
      setFeedbackMessage('设置已保存。');
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : '设置保存失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="settings-page">
      <header className="section-heading-settings">
        <div>
          <h2 className="settings-title">配置模型连接</h2>
          <p className="settings-subtitle">先配置模型参数，再回到聊天区直接发问。</p>
        </div>
      </header>

      {feedbackMessage ? <div className="info-banner">{feedbackMessage}</div> : null}

      <ChatSettingsForm disabled={isSaving} value={settings} onChange={handleSettingsChange} onSubmit={handleSave} />
    </section>
  );
}
