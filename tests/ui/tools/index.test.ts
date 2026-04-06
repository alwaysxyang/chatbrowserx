import { describe, expect, it, vi } from 'vitest';
import { registerTools } from '../../../src/ui/tools';

describe('ui tools index', () => {
  it('registers all tool listeners through one entry point', () => {
    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>;

    registerTools();

    expect(addListenerMock).toHaveBeenCalledTimes(1);
  });
});
