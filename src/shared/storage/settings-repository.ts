import type { Settings } from '../types/settings';
import { defaultSettings, normalizeSettings } from './settings-normalizer';
import { loadStoredValue, saveStoredValue } from './chrome-local-storage';

const settingsStorageKey = 'chatbrowserx.settings';
export { defaultSettings };

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await loadStoredValue<Partial<Settings> | undefined>(settingsStorageKey, undefined));
}

export async function saveSettings(nextSettings: Partial<Settings>): Promise<Settings> {
  const mergedSettings = normalizeSettings({
    ...(await loadSettings()),
    ...nextSettings,
  });

  await saveStoredValue(settingsStorageKey, mergedSettings);

  return mergedSettings;
}
