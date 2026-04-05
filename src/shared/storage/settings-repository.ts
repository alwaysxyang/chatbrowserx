import type { ChatProviderId, ChatSettings } from '../types/settings';

const settingsStorageKey = 'chatbrowserx.settings';

export const defaultSettings: ChatSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  systemPrompt: 'You are ChatBrowserX, a helpful browser agent assistant.',
  maxHistory: 50,
};

function normalizeSettings(settings: Partial<ChatSettings> | undefined): ChatSettings {
  return {
    provider:
      settings?.provider === 'openai' || settings?.provider === 'codex'
        ? (settings.provider as ChatProviderId)
        : defaultSettings.provider,
    apiKey: typeof settings?.apiKey === 'string' ? settings.apiKey : defaultSettings.apiKey,
    baseUrl: typeof settings?.baseUrl === 'string' && settings.baseUrl.trim() ? settings.baseUrl : defaultSettings.baseUrl,
    model: typeof settings?.model === 'string' ? settings.model : defaultSettings.model,
    systemPrompt:
      typeof settings?.systemPrompt === 'string' && settings.systemPrompt.trim()
        ? settings.systemPrompt
        : defaultSettings.systemPrompt,
    maxHistory:
      typeof settings?.maxHistory === 'number' && Number.isFinite(settings.maxHistory) && settings.maxHistory > 0
        ? settings.maxHistory
        : defaultSettings.maxHistory,
  };
}

export async function loadSettings(): Promise<ChatSettings> {
  const result = await chrome.storage.local.get(settingsStorageKey);
  const storedSettings = result[settingsStorageKey] as Partial<ChatSettings> | undefined;

  return normalizeSettings(storedSettings);
}

export async function saveSettings(nextSettings: Partial<ChatSettings>): Promise<ChatSettings> {
  const mergedSettings = normalizeSettings({
    ...(await loadSettings()),
    ...nextSettings,
  });

  await chrome.storage.local.set({
    [settingsStorageKey]: mergedSettings,
  });

  return mergedSettings;
}
