import {
  getActiveProviderBaseUrl,
  getActiveProviderCredential,
  getActiveProviderModel,
  isOpenAIProvider,
  type ChatProviderId,
  type ModelSettings,
} from '../../../shared/types/settings';

/**
 * Switch the active chat provider while keeping the mirrored top-level model in sync.
 */
export function updateProvider(settings: ModelSettings, provider: ChatProviderId): ModelSettings {
  return {
    ...settings,
    provider,
    model: provider === 'openai' ? settings.openai.model : settings.codex.model,
  };
}

/**
 * Update model settings that are shared across providers.
 */
export function updateSharedModelSettings<K extends 'systemPrompt' | 'maxHistory' | 'tavilyApiKey'>(
  settings: ModelSettings,
  field: K,
  nextValue: ModelSettings[K],
): ModelSettings {
  return {
    ...settings,
    [field]: nextValue,
  };
}

/**
 * Update the OpenAI-specific configuration while preserving other provider settings.
 */
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

/**
 * Update the Codex-specific configuration while preserving other provider settings.
 */
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

/**
 * Resolve the provider-specific field values that should be shown in the model settings form.
 */
export function getActiveProviderFormValues(settings: ModelSettings) {
  return {
    isOpenAi: isOpenAIProvider(settings),
    baseUrl: getActiveProviderBaseUrl(settings),
    credential: getActiveProviderCredential(settings),
    model: getActiveProviderModel(settings),
  };
}
