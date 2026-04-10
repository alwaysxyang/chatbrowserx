const defaultScopedStorageSuffix = 'default';

export function buildScopedStorageKey(prefix: string, scope: string): string {
  const normalizedScope = (scope || '').trim() || defaultScopedStorageSuffix;
  return `${prefix}.${normalizedScope}`;
}

export async function loadStoredValue<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  const storedValue = result[key] as T | undefined;
  return storedValue ?? fallback;
}

export async function saveStoredValue<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({
      [key]: value,
    });
  } catch (error) {
    console.error('[ChatBrowserX] Failed to save to storage:', {
      key,
      error,
      valueSize: JSON.stringify(value).length,
    });
    throw error;
  }
}

export async function removeStoredValue(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}
