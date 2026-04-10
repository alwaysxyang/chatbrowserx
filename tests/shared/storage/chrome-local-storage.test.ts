import { describe, expect, it } from 'vitest';
import {
  buildScopedStorageKey,
  loadStoredValue,
  removeStoredValue,
  saveStoredValue,
} from '../../../src/shared/storage/chrome-local-storage';

describe('chrome local storage helpers', () => {
  it('builds stable scoped storage keys with default fallback', () => {
    expect(buildScopedStorageKey('chatbrowserx.panel', 'example.com')).toBe('chatbrowserx.panel.example.com');
    expect(buildScopedStorageKey('chatbrowserx.panel', '')).toBe('chatbrowserx.panel.default');
  });

  it('loads, saves and removes values through a shared wrapper', async () => {
    const key = 'chatbrowserx.test.key';

    expect(await loadStoredValue(key, 'fallback')).toBe('fallback');

    await saveStoredValue(key, 'value');
    expect(await loadStoredValue(key, 'fallback')).toBe('value');

    await removeStoredValue(key);
    expect(await loadStoredValue(key, 'fallback')).toBe('fallback');
  });
});
