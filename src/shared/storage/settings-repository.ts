import type { ChatProviderId, ModelSettings, Settings, UiLanguage } from '../types/settings';

const settingsStorageKey = 'chatbrowserx.settings';

export const defaultSettings: Settings = {
  model: {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    systemPrompt: 'You are ChatBrowserX, a helpful browser agent assistant.',
    maxHistory: 50,
  },
  general: {
    uiLanguage: 'system',
  },
};

function normalizeModelSettings(model: Partial<ModelSettings> | undefined): ModelSettings {
  return {
    provider:
      model?.provider === 'openai' || model?.provider === 'codex'
        ? (model.provider as ChatProviderId)
        : defaultSettings.model.provider,
    apiKey: typeof model?.apiKey === 'string' ? model.apiKey : defaultSettings.model.apiKey,
    baseUrl:
      typeof model?.baseUrl === 'string' && model.baseUrl.trim() ? model.baseUrl : defaultSettings.model.baseUrl,
    model: typeof model?.model === 'string' ? model.model : defaultSettings.model.model,
    systemPrompt:
      typeof model?.systemPrompt === 'string' && model.systemPrompt.trim()
        ? model.systemPrompt
        : defaultSettings.model.systemPrompt,
    maxHistory:
      typeof model?.maxHistory === 'number' && Number.isFinite(model.maxHistory) && model.maxHistory > 0
        ? model.maxHistory
        : defaultSettings.model.maxHistory,
  };
}

function normalizeSettings(settings: Partial<Settings> | undefined): Settings {
  const normalizedModel = normalizeModelSettings(settings?.model);

  return {
    model: normalizedModel,
    general: {
      uiLanguage:
        settings?.general?.uiLanguage === 'system' ||
        settings?.general?.uiLanguage === 'zh' ||
        settings?.general?.uiLanguage === 'en' ||
        settings?.general?.uiLanguage === 'ja'
          ? (settings.general.uiLanguage as UiLanguage)
          : defaultSettings.general.uiLanguage,
    },
  };
}

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(settingsStorageKey);
  const storedSettings = result[settingsStorageKey] as Partial<Settings> | undefined;

  return normalizeSettings(storedSettings);
}

export async function saveSettings(nextSettings: Partial<Settings>): Promise<Settings> {
  const mergedSettings = normalizeSettings({
    ...(await loadSettings()),
    ...nextSettings,
  });

  await chrome.storage.local.set({
    [settingsStorageKey]: mergedSettings,
  });

  return mergedSettings;
}
