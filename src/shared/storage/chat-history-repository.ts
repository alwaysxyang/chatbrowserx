import type { ChatMessage } from '../types/chat';

const getStorageKey = (hostname: string) => `chatbrowserx.history.${hostname}`;
const getPendingStorageKey = (scope: string) => `chatbrowserx.pending.${scope}`;

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
  const result = await chrome.storage.local.get(getStorageKey(hostname));
  const history = result[getStorageKey(hostname)] as ChatMessage[] | undefined;
  return history ?? [];
}

export async function saveChatHistory(hostname: string, messages: ChatMessage[]): Promise<void> {
  await chrome.storage.local.set({
    [getStorageKey(hostname)]: messages,
  });
}

export async function clearChatHistory(hostname: string): Promise<void> {
  await chrome.storage.local.remove(getStorageKey(hostname));
}

export async function loadPendingChatReply(scope: string): Promise<PendingChatReply | null> {
  const result = await chrome.storage.local.get(getPendingStorageKey(scope));
  const pending = result[getPendingStorageKey(scope)] as PendingChatReply | undefined;
  return pending ?? null;
}

export async function savePendingChatReply(scope: string, pending: PendingChatReply): Promise<void> {
  await chrome.storage.local.set({
    [getPendingStorageKey(scope)]: pending,
  });
}

export async function clearPendingChatReply(scope: string): Promise<void> {
  await chrome.storage.local.remove(getPendingStorageKey(scope));
}
