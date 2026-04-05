import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from '../../../src/shared/storage/settings-repository';

describe('settings repository', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await loadSettings();

    expect(settings).toEqual(defaultSettings);
  });

  it('persists merged settings', async () => {
    await saveSettings({
      model: { apiKey: 'test-key', model: 'gpt-4o-mini', provider: 'openai' },
    });

    const settings = await loadSettings();

    expect(settings.model.apiKey).toBe('test-key');
    expect(settings.model.model).toBe('gpt-4o-mini');
    expect(settings.model.baseUrl).toBe(defaultSettings.model.baseUrl);
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

    expect(settings.model.baseUrl).toBe(defaultSettings.model.baseUrl);
    expect(settings.model.systemPrompt).toBe(defaultSettings.model.systemPrompt);
    expect(settings.model.maxHistory).toBe(defaultSettings.model.maxHistory);
    expect(settings.model.model).toBe('bad-model');
  });
});
