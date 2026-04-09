import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from '../../../src/shared/storage/settings-repository';

describe('settings repository', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await loadSettings();

    expect(settings).toEqual(defaultSettings);
  });

  it('persists merged settings', async () => {
    await saveSettings({
      model: {
        ...defaultSettings.model,
        model: 'gpt-4o-mini',
        provider: 'openai',
        openai: {
          ...defaultSettings.model.openai,
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
        },
      },
    });

    const settings = await loadSettings();

    expect(settings.model.openai.apiKey).toBe('test-key');
    expect(settings.model.model).toBe('gpt-4o-mini');
    expect(settings.model.openai.baseUrl).toBe(defaultSettings.model.openai.baseUrl);
  });

  it('normalizes malformed persisted settings', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.settings': {
        model: {
          apiKey: 'x',
          baseUrl: 1,
          model: 'bad-model',
          systemPrompt: null,
          maxHistory: 'oops',
        },
      },
    });

    const settings = await loadSettings();

    expect(settings.model.openai.baseUrl).toBe(defaultSettings.model.openai.baseUrl);
    expect(settings.model.systemPrompt).toBe(defaultSettings.model.systemPrompt);
    expect(settings.model.maxHistory).toBe(defaultSettings.model.maxHistory);
    expect(settings.model.model).toBe('bad-model');
    expect(settings.model.openai.model).toBe('bad-model');
  });
});
