import { describe, expect, it } from 'vitest';
import { registerTools } from '../../../src/ui/tools';

describe('ui tools index', () => {
  it('registers all tool listeners through one entry point', () => {
    const addListenerMock = globalThis.__chromeTestUtils.getRuntimeOnMessageAddListenerMock();

    registerTools();

    expect(addListenerMock).toHaveBeenCalledTimes(2);
  });
});
