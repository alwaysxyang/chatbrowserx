import type { ChatMessage } from '../types/chat';
import { loadStoredValue, removeStoredValue, saveStoredValue } from './chrome-local-storage';

const chatHistoryStorageKey = 'chatbrowserx.history';

/**
 * Loads the profile-wide chat transcript.
 */
export async function loadChatHistory(): Promise<ChatMessage[]> {
  return loadStoredValue(chatHistoryStorageKey, [] as ChatMessage[]);
}

/**
 * Saves the profile-wide chat transcript.
 *
 * @param messages - The complete global chat transcript.
 */
export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  await saveStoredValue(chatHistoryStorageKey, messages);
}

/**
 * Clears the profile-wide chat transcript.
 */
export async function clearChatHistory(): Promise<void> {
  await removeStoredValue(chatHistoryStorageKey);
}
