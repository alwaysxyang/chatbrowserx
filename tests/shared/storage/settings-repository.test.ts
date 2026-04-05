import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from '../../../src/shared/storage/settings-repository';

describe('settings repository', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await loadSettings();

    expect(settings).toEqual(defaultSettings);
  });

  it('persists merged settings', async () => {
    await saveSettings({ apiKey: 'test-key', model: 'gpt-4o-mini', provider: 'openai' });

    const settings = await loadSettings();

    expect(settings.apiKey).toBe('test-key');
    expect(settings.model).toBe('gpt-4o-mini');
    expect(settings.baseUrl).toBe(defaultSettings.baseUrl);
  });

  it('normalizes malformed persisted settings', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.settings': {
        apiKey: 'x',
        baseUrl: 1,
        model: 'bad-model',
        systemPrompt: null,
        maxHistory: 'oops',
      },
    });

    const settings = await loadSettings();

    expect(settings.baseUrl).toBe(defaultSettings.baseUrl);
    expect(settings.systemPrompt).toBe(defaultSettings.systemPrompt);
    expect(settings.maxHistory).toBe(defaultSettings.maxHistory);
    expect(settings.model).toBe('bad-model');
  });
});
