import type { ChatMessage } from '../types/chat';
import { buildScopedStorageKey, loadStoredValue, removeStoredValue, saveStoredValue } from './chrome-local-storage';

const getStorageKey = (hostname: string) => buildScopedStorageKey('chatbrowserx.history', hostname);

export async function loadChatHistory(hostname: string): Promise<ChatMessage[]> {
  return loadStoredValue(getStorageKey(hostname), [] as ChatMessage[]);
}

export async function saveChatHistory(hostname: string, messages: ChatMessage[]): Promise<void> {
  await saveStoredValue(getStorageKey(hostname), messages);
}

export async function clearChatHistory(hostname: string): Promise<void> {
  await removeStoredValue(getStorageKey(hostname));
}
