import type { ChatMessage } from '../types/chat';
import { buildScopedStorageKey, loadStoredValue, removeStoredValue, saveStoredValue } from './chrome-local-storage';

const getStorageKey = (hostname: string) => buildScopedStorageKey('chatbrowserx.history', hostname);
const getPendingStorageKey = (scope: string) => buildScopedStorageKey('chatbrowserx.pending', scope);

export interface PendingChatReply {
  content: string;
  errorMessage?: string;
  createdAt?: string;
}

export function buildPendingChatScope(locationObject: Location): string {
  const href = (locationObject.href || '').trim();

  if (!href) {
    return 'default';
  }

  const hashIndex = href.indexOf('#');
  return hashIndex >= 0 ? href.slice(0, hashIndex) : href;
}

export async function loadChatHistory(hostname: string): Promise<ChatMessage[]> {
  return loadStoredValue(getStorageKey(hostname), [] as ChatMessage[]);
}

export async function saveChatHistory(hostname: string, messages: ChatMessage[]): Promise<void> {
  await saveStoredValue(getStorageKey(hostname), messages);
}

export async function clearChatHistory(hostname: string): Promise<void> {
  await removeStoredValue(getStorageKey(hostname));
}

export async function loadPendingChatReply(scope: string): Promise<PendingChatReply | null> {
  return loadStoredValue<PendingChatReply | null>(getPendingStorageKey(scope), null);
}

export async function savePendingChatReply(scope: string, pending: PendingChatReply): Promise<void> {
  await saveStoredValue(getPendingStorageKey(scope), pending);
}

export async function clearPendingChatReply(scope: string): Promise<void> {
  await removeStoredValue(getPendingStorageKey(scope));
}
