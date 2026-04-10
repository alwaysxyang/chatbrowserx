import { buildScopedStorageKey } from '../../shared/storage/chrome-local-storage';

export function normalizeHostnameForStorage(hostname: string): string {
  const raw = (hostname || '').trim().toLowerCase();
  if (!raw) {
    return 'default';
  }

  const parts = raw.split('.');
  if (parts.length <= 2) {
    return raw;
  }

  const secondLevel = parts[parts.length - 2];
  const topLevel = parts[parts.length - 1];
  return `${secondLevel}.${topLevel}`;
}

export function getPanelStateStorageKey(hostname: string): string {
  return buildScopedStorageKey('chatbrowserx.panel', hostname);
}
