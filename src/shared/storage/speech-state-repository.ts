/**
 * Tab-level speech state repository
 * Stores voice recognition state per tab
 */

export interface SpeechState {
  isActive: boolean;
  sourceText: string;
  translationText: string;
}

const STORAGE_KEY_PREFIX = 'speech_state_tab_';

function getStorageKey(tabId: number): string {
  return `${STORAGE_KEY_PREFIX}${tabId}`;
}

export async function getSpeechState(tabId: number): Promise<SpeechState | null> {
  const key = getStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return result[key] || null;
}

export async function setSpeechState(tabId: number, state: SpeechState): Promise<void> {
  const key = getStorageKey(tabId);
  await chrome.storage.session.set({ [key]: state });
}

export async function clearSpeechState(tabId: number): Promise<void> {
  const key = getStorageKey(tabId);
  await chrome.storage.session.remove(key);
}

export async function getAllSpeechStates(): Promise<Record<number, SpeechState>> {
  const result = await chrome.storage.session.get(null);
  const states: Record<number, SpeechState> = {};

  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      const tabId = parseInt(key.replace(STORAGE_KEY_PREFIX, ''), 10);
      if (!isNaN(tabId)) {
        states[tabId] = value as SpeechState;
      }
    }
  }

  return states;
}
