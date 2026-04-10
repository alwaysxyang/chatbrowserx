import { describe, expect, it } from 'vitest';
import {
  getActiveProviderBaseUrl,
  getActiveProviderCredential,
  getActiveProviderModel,
  isOpenAIProvider,
  isCodexProvider,
  type ModelSettings,
} from '../../../src/shared/types/settings';

const baseSettings: ModelSettings = {
  provider: 'openai',
  model: 'openai-primary',
  systemPrompt: 'system prompt',
  maxHistory: 12,
  openai: {
    apiKey: 'openai-key',
    model: 'openai-primary',
    baseUrl: 'https://openai.example.com',
  },
  codex: {
    accessToken: 'codex-token',
    model: 'codex-secondary',
    baseUrl: 'https://codex.example.com',
  },
};

describe('settings helpers', () => {
  it('returns active provider values for openai', () => {
    expect(getActiveProviderBaseUrl(baseSettings)).toBe('https://openai.example.com');
    expect(getActiveProviderCredential(baseSettings)).toBe('openai-key');
    expect(getActiveProviderModel(baseSettings)).toBe('openai-primary');
  });

  it('returns active provider values for codex', () => {
    const settings: ModelSettings = {
      ...baseSettings,
      provider: 'codex',
      model: 'codex-secondary',
    };

    expect(getActiveProviderBaseUrl(settings)).toBe('https://codex.example.com');
    expect(getActiveProviderCredential(settings)).toBe('codex-token');
    expect(getActiveProviderModel(settings)).toBe('codex-secondary');
  });

  it('identifies openai provider correctly', () => {
    expect(isOpenAIProvider(baseSettings)).toBe(true);

    const codexSettings: ModelSettings = {
      ...baseSettings,
      provider: 'codex',
    };
    expect(isOpenAIProvider(codexSettings)).toBe(false);
  });

  it('identifies codex provider correctly', () => {
    expect(isCodexProvider(baseSettings)).toBe(false);

    const codexSettings: ModelSettings = {
      ...baseSettings,
      provider: 'codex',
    };
    expect(isCodexProvider(codexSettings)).toBe(true);
  });
});
