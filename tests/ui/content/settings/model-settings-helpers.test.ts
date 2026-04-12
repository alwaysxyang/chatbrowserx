import { describe, expect, it } from 'vitest';
import type { ModelSettings } from '../../../../src/shared/types/settings';
import {
  updateCodexSettings,
  updateOpenAiSettings,
  updateSharedModelSettings,
  updateProvider,
} from '../../../../src/ui/content/settings/model-settings-helpers';

const baseSettings: ModelSettings = {
  provider: 'openai',
  model: 'openai-model',
  systemPrompt: 'system prompt',
  maxHistory: 20,
  tavilyApiKey: 'tavily-key',
  openai: {
    apiKey: 'openai-key',
    model: 'openai-model',
    baseUrl: 'https://openai.example.com',
  },
  codex: {
    accessToken: 'codex-token',
    model: 'codex-model',
    baseUrl: 'https://codex.example.com',
  },
};

describe('model settings helpers', () => {
  it('keeps the top-level model aligned with the selected provider', () => {
    expect(updateProvider(baseSettings, 'codex').model).toBe('codex-model');
    expect(updateProvider({ ...baseSettings, provider: 'codex', model: 'codex-model' }, 'openai').model).toBe('openai-model');
  });

  it('updates only openai settings and keeps the active model mirrored', () => {
    const result = updateOpenAiSettings(baseSettings, {
      model: 'openai-next',
      baseUrl: 'https://openai-next.example.com',
    });

    expect(result.model).toBe('openai-next');
    expect(result.openai).toMatchObject({
      model: 'openai-next',
      baseUrl: 'https://openai-next.example.com',
    });
    expect(result.codex).toEqual(baseSettings.codex);
  });

  it('updates only codex settings and keeps the active model mirrored', () => {
    const settings = updateProvider(baseSettings, 'codex');
    const result = updateCodexSettings(settings, {
      model: 'codex-next',
      accessToken: 'codex-next-token',
    });

    expect(result.model).toBe('codex-next');
    expect(result.codex).toMatchObject({
      model: 'codex-next',
      accessToken: 'codex-next-token',
    });
    expect(result.openai).toEqual(baseSettings.openai);
  });

  it('updates shared model settings including the Tavily API key', () => {
    const result = updateSharedModelSettings(baseSettings, 'tavilyApiKey', 'next-tavily-key');

    expect(result.tavilyApiKey).toBe('next-tavily-key');
    expect(result.openai).toEqual(baseSettings.openai);
    expect(result.codex).toEqual(baseSettings.codex);
  });
});
