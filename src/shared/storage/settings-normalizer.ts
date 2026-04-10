import type { ChatProviderId, ModelSettings, Settings, UiLanguage } from '../types/settings';

export const defaultSettings: Settings = {
  model: {
    provider: 'openai',
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
    uiLanguage: 'zh',
  },
};

function normalizeModelSettings(raw: Partial<any> | undefined): ModelSettings {
  const model = raw ?? {};
  const provider: ChatProviderId =
    model.provider === 'openai' || model.provider === 'codex'
      ? (model.provider as ChatProviderId)
      : defaultSettings.model.provider;
  const openaiBaseUrl =
    typeof model.openai?.baseUrl === 'string' && model.openai.baseUrl.trim()
      ? model.openai.baseUrl
      : provider === 'openai' && typeof model.baseUrl === 'string' && model.baseUrl.trim()
      ? model.baseUrl
      : defaultSettings.model.openai.baseUrl;
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

export function normalizeSettings(settings: Partial<Settings> | undefined): Settings {
  return {
    model: normalizeModelSettings(settings?.model),
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
