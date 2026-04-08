import type { ChatProviderId, ModelSettings, Settings, UiLanguage } from '../types/settings';

const settingsStorageKey = 'chatbrowserx.settings';

export const defaultSettings: Settings = {
  model: {
    provider: 'openai',
    // 初始别名指向 OpenAI 的默认配置
    model: '',
    systemPrompt: 'You are ChatBrowserX, a helpful browser agent assistant.',
    maxHistory: 50,
    openai: {
      apiKey: '',
      model: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    },
    codex: {
      accessToken: '',
      model: 'gpt-5.4',
       baseUrl: 'https://chatgpt.com/backend-api',
    },
  },
  general: {
    // 默认中文界面；用户可以在通用设置里改为跟随系统 / 英文 / 日文
    uiLanguage: 'zh',
  },
};

function normalizeModelSettings(raw: Partial<any> | undefined): ModelSettings {
  const model = raw ?? {};

  const provider: ChatProviderId =
    model.provider === 'openai' || model.provider === 'codex'
      ? (model.provider as ChatProviderId)
      : defaultSettings.model.provider;

  // OpenAI baseUrl：优先读取 openai.baseUrl，其次兼容旧的顶层 baseUrl
  const openaiBaseUrl =
    typeof model.openai?.baseUrl === 'string' && model.openai.baseUrl.trim()
      ? model.openai.baseUrl
      : provider === 'openai' && typeof model.baseUrl === 'string' && model.baseUrl.trim()
      ? model.baseUrl
      : defaultSettings.model.openai.baseUrl;

  // Codex baseUrl：优先读取 codex.baseUrl，其次兼容旧的顶层 baseUrl
  const codexBaseUrl =
    typeof model.codex?.baseUrl === 'string' && model.codex.baseUrl.trim()
      ? model.codex.baseUrl
      : provider === 'codex' && typeof model.baseUrl === 'string' && model.baseUrl.trim()
      ? model.baseUrl
      : defaultSettings.model.codex.baseUrl;

  const systemPrompt =
    typeof model.systemPrompt === 'string' && model.systemPrompt.trim()
      ? model.systemPrompt
      : defaultSettings.model.systemPrompt;

  const maxHistory =
    typeof model.maxHistory === 'number' && Number.isFinite(model.maxHistory) && model.maxHistory > 0
      ? model.maxHistory
      : defaultSettings.model.maxHistory;

  // 兼容旧结构：旧版把 openai 的 apiKey/model 直接放在顶层
  const openaiApiKey =
    typeof model.openai?.apiKey === 'string'
      ? model.openai.apiKey
      : typeof model.apiKey === 'string'
      ? model.apiKey
      : defaultSettings.model.openai.apiKey;

  const openaiModelName =
    typeof model.openai?.model === 'string'
      ? model.openai.model
      : provider === 'openai' && typeof model.model === 'string'
      ? model.model
      : defaultSettings.model.openai.model;

  const codexAccessToken =
    typeof model.codex?.accessToken === 'string'
      ? model.codex.accessToken
      : typeof model.accessToken === 'string'
      ? model.accessToken
      : typeof model.apiKey === 'string' && provider === 'codex'
      ? model.apiKey
      : defaultSettings.model.codex.accessToken;

  const codexModelName =
    typeof model.codex?.model === 'string'
      ? model.codex.model
      : provider === 'codex' && typeof model.model === 'string'
      ? model.model
      : defaultSettings.model.codex.model;

  // 根据当前 provider 计算别名字段
  const baseUrl = provider === 'openai' ? openaiBaseUrl : codexBaseUrl;
  const apiKey = provider === 'openai' ? openaiApiKey : codexAccessToken;
  const aliasModelName = provider === 'openai' ? openaiModelName : codexModelName;

  return {
    provider,
    model: aliasModelName,
    systemPrompt,
    maxHistory,
    openai: {
      apiKey: openaiApiKey,
      model: openaiModelName,
      baseUrl: openaiBaseUrl,
    },
    codex: {
      accessToken: codexAccessToken,
      model: codexModelName,
      baseUrl: codexBaseUrl,
    },
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
