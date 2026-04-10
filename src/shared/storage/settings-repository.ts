import type { Settings } from '../types/settings';
import { defaultSettings, normalizeSettings } from './settings-normalizer';

const settingsStorageKey = 'chatbrowserx.settings';
export { defaultSettings };

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(settingsStorageKey);
  const storedSettings = result[settingsStorageKey] as Partial<Settings> | undefined;

  return normalizeSettings(storedSettings);
}

export async function saveSettings(nextSettings: Partial<Settings>): Promise<Settings> {
  const mergedSettings = normalizeSettings({
    ...(await loadSettings()),
    ...nextSettings,
  });

  await chrome.storage.local.set({
    [settingsStorageKey]: mergedSettings,
  });

  return mergedSettings;
}
