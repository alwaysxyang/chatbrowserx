import {
  getActiveProviderBaseUrl,
  getActiveProviderCredential,
  getActiveProviderModel,
  isOpenAIProvider,
  type ChatProviderId,
  type ModelSettings,
} from '../../../shared/types/settings';

export function updateProvider(settings: ModelSettings, provider: ChatProviderId): ModelSettings {
  return {
    ...settings,
    provider,
    model: provider === 'openai' ? settings.openai.model : settings.codex.model,
  };
}

export function updateSharedModelSettings<K extends 'systemPrompt' | 'maxHistory'>(
  settings: ModelSettings,
  field: K,
  nextValue: ModelSettings[K],
): ModelSettings {
  return {
    ...settings,
    [field]: nextValue,
  };
}

export function updateOpenAiSettings(
  settings: ModelSettings,
  nextValue: Partial<ModelSettings['openai']>,
): ModelSettings {
  const openai = { ...settings.openai, ...nextValue };

  return {
    ...settings,
    model: settings.provider === 'openai' ? openai.model : settings.model,
    openai,
  };
}

export function updateCodexSettings(
  settings: ModelSettings,
  nextValue: Partial<ModelSettings['codex']>,
): ModelSettings {
  const codex = { ...settings.codex, ...nextValue };

  return {
    ...settings,
    model: settings.provider === 'codex' ? codex.model : settings.model,
    codex,
  };
}

export function getActiveProviderFormValues(settings: ModelSettings) {
  return {
    isOpenAi: isOpenAIProvider(settings),
    baseUrl: getActiveProviderBaseUrl(settings),
    credential: getActiveProviderCredential(settings),
    model: getActiveProviderModel(settings),
  };
}
