import type { SpeechSettings } from '../types/speech';
import { loadStoredValue, saveStoredValue } from './chrome-local-storage';

const speechSettingsStorageKey = 'chatbrowserx.speech.settings';

export const defaultSpeechSettings: SpeechSettings = {
  provider: 'volcengine',
  sourceLanguage: 'auto',
  targetLanguage: 'none',
  volcengine: {
    appKey: '',
    accessKey: '',
  },
};

function normalizeSpeechSettings(partial: Partial<SpeechSettings> | undefined): SpeechSettings {
  return {
    provider: partial?.provider || defaultSpeechSettings.provider,
    sourceLanguage: partial?.sourceLanguage || defaultSpeechSettings.sourceLanguage,
    targetLanguage: partial?.targetLanguage || defaultSpeechSettings.targetLanguage,
    volcengine: {
      appKey: partial?.volcengine?.appKey || defaultSpeechSettings.volcengine.appKey,
      accessKey: partial?.volcengine?.accessKey || defaultSpeechSettings.volcengine.accessKey,
    },
  };
}

export async function loadSpeechSettings(): Promise<SpeechSettings> {
  return normalizeSpeechSettings(await loadStoredValue<Partial<SpeechSettings> | undefined>(speechSettingsStorageKey, undefined));
}

export async function saveSpeechSettings(nextSettings: Partial<SpeechSettings>): Promise<SpeechSettings> {
  const mergedSettings = normalizeSpeechSettings({
    ...(await loadSpeechSettings()),
    ...nextSettings,
  });

  await saveStoredValue(speechSettingsStorageKey, mergedSettings);

  return mergedSettings;
}
