import type { ChatMessage } from '../types/chat';

const getStorageKey = (hostname: string) => `chatbrowserx.history.${hostname}`;

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
