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
  const [activeTab, setActiveTab] = useState<'model' | 'general'>('model');
  const [saveToast, setSaveToast] = useState<string | null>(null);

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
    setSaveToast(null);

    try {
      // 先等待一小段时间，再真实保存，给用户一个“保存中”的感受
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await saveSettings(settings);

      // 保存成功使用模态提示框，不再占用顶部 banner
      setSaveToast('设置已保存。');
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : '设置保存失败。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    hasUserInteractedRef.current = true;
    setFeedbackMessage(null);
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
      <nav aria-label="设置分类" className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'model' ? 'settings-tab-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('model')}
        >
          模型
        </button>
        <button
          className={`settings-tab ${activeTab === 'general' ? 'settings-tab-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('general')}
        >
          通用
        </button>
      </nav>

      {saveToast ? (
        <div className="settings-toast" role="status" aria-live="polite">
          {saveToast}
        </div>
      ) : null}

      {feedbackMessage ? <div className="info-banner">{feedbackMessage}</div> : null}

      {activeTab === 'model' ? (
        <ChatSettingsForm disabled={isSaving} value={settings} onChange={handleSettingsChange} />
      ) : (
        <div className="settings-general-placeholder">通用设置开发中</div>
      )}

      <footer className="settings-footer">
        <button
          className="primary-button"
          data-tooltip={isSaving ? '正在保存…' : '保存当前设置'}
          disabled={isSaving}
          type="button"
          onClick={handleSave}
        >
          {isSaving ? '保存中…' : '保存设置'}
        </button>
        <button
          className="secondary-button"
          data-tooltip="恢复为默认配置（不会立即保存）"
          type="button"
          onClick={handleResetToDefault}
        >
          恢复默认
        </button>
      </footer>
    </section>
  );
}
