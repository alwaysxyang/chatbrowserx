/**
 * Supported chat provider identifiers.
 * - 'openai': OpenAI-compatible API providers
 * - 'codex': Codex-specific API providers
 */
export type ChatProviderId = 'openai' | 'codex';

/**
 * UI language options.
 * - 'system': Follow browser/system language
 * - 'zh': Chinese
 * - 'en': English
 * - 'ja': Japanese
 */
export type UiLanguage = 'system' | 'zh' | 'en' | 'ja';

/**
 * OpenAI provider-specific configuration.
 */
export interface OpenAIModelSettings {
  /** API key for authentication */
  apiKey: string;
  /** Model identifier (e.g., 'gpt-4', 'gpt-3.5-turbo') */
  model: string;
  /** Base URL for the OpenAI-compatible API endpoint */
  baseUrl: string;
}

/**
 * Codex provider-specific configuration.
 */
export interface CodexModelSettings {
  /** Access token for authentication */
  accessToken: string;
  /** Model identifier */
  model: string;
  /** Base URL for the Codex API endpoint */
  baseUrl: string;
}

/**
 * Model-related settings including provider configuration.
 * Each provider maintains its own independent configuration.
 */
export interface ModelSettings {
  /** Currently active provider */
  provider: ChatProviderId;
  /**
   * Compatibility field: mirrors the active provider's model.
   * Used for backward compatibility with older data structures.
   */
  model: string;

  /** System prompt sent with every chat request */
  systemPrompt: string;
  /** Maximum number of historical messages to include in context */
  maxHistory: number;

  /** OpenAI provider configuration */
  openai: OpenAIModelSettings;
  /** Codex provider configuration */
  codex: CodexModelSettings;
}

/**
 * General application settings.
 */
export interface GeneralSettings {
  /** UI language preference */
  uiLanguage: UiLanguage;
}

/**
 * Complete application settings structure.
 */
export interface Settings {
  /** Model and provider configuration */
  model: ModelSettings;
  /** General UI and behavior settings */
  general: GeneralSettings;
}

/**
 * Get the base URL of the currently active provider.
 * @param settings - The model settings
 * @returns The base URL for the active provider
 */
export function getActiveProviderBaseUrl(settings: ModelSettings): string {
  return settings.provider === 'openai' ? settings.openai.baseUrl : settings.codex.baseUrl;
}

/**
 * Get the authentication credential of the currently active provider.
 * @param settings - The model settings
 * @returns API key for OpenAI or access token for Codex
 */
export function getActiveProviderCredential(settings: ModelSettings): string {
  return settings.provider === 'openai' ? settings.openai.apiKey : settings.codex.accessToken;
}

/**
 * Get the model identifier of the currently active provider.
 * @param settings - The model settings
 * @returns The model identifier for the active provider
 */
export function getActiveProviderModel(settings: ModelSettings): string {
  return settings.provider === 'openai' ? settings.openai.model : settings.codex.model;
}

/**
 * Type guard to check if the current provider is OpenAI.
 * @param settings - The model settings to check
 * @returns true if the provider is 'openai'
 */
export function isOpenAIProvider(settings: ModelSettings): settings is ModelSettings & { provider: 'openai' } {
  return settings.provider === 'openai';
}

/**
 * Type guard to check if the current provider is Codex.
 * @param settings - The model settings to check
 * @returns true if the provider is 'codex'
 */
export function isCodexProvider(settings: ModelSettings): settings is ModelSettings & { provider: 'codex' } {
  return settings.provider === 'codex';
}
