import type { SpeechSettings } from '../types/speech';
import { loadStoredValue, saveStoredValue } from './chrome-local-storage';

const speechSettingsStorageKey = 'chatbrowserx.speech.settings';

export const defaultSpeechSettings: SpeechSettings = {
  provider: 'volcengine',
  sourceLanguage: 'auto',
  targetLanguage: 'none',
  volcengine: {
    accessKeyId: '',
    secretAccessKey: '',
  },
};

function normalizeSpeechSettings(partial: Partial<SpeechSettings> | undefined): SpeechSettings {
  return {
    provider: partial?.provider || defaultSpeechSettings.provider,
    sourceLanguage: partial?.sourceLanguage || defaultSpeechSettings.sourceLanguage,
    targetLanguage: partial?.targetLanguage || defaultSpeechSettings.targetLanguage,
    volcengine: {
      accessKeyId: partial?.volcengine?.accessKeyId || defaultSpeechSettings.volcengine.accessKeyId,
      secretAccessKey: partial?.volcengine?.secretAccessKey || defaultSpeechSettings.volcengine.secretAccessKey,
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
