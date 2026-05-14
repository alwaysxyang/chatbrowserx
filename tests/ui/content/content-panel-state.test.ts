import { describe, expect, it } from 'vitest';
import { getPanelStateStorageKey } from '../../../src/ui/content/content-panel-state';

describe('content panel state', () => {
  it('uses one global panel state key', () => {
    expect(getPanelStateStorageKey()).toBe('chatbrowserx.panel');
  });
});
