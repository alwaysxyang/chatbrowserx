import { describe, expect, it } from 'vitest';
import {
  chatRequestType,
  createRuntimeMessageGuard,
  getRuntimeResponseData,
  hasRuntimeMessageType,
} from '../../../src/shared/types/runtime-messages';

describe('runtime message helpers', () => {
  it('matches runtime messages by type through shared helpers', () => {
    const isChatRequestMessage = createRuntimeMessageGuard<{ type: typeof chatRequestType; payload: { input: string } }>(
      chatRequestType,
    );

    expect(hasRuntimeMessageType({ type: chatRequestType }, chatRequestType)).toBe(true);
    expect(isChatRequestMessage({ type: chatRequestType, payload: { input: 'hello' } })).toBe(true);
    expect(isChatRequestMessage({ type: 'other' })).toBe(false);
    expect(isChatRequestMessage(null)).toBe(false);
  });

  it('unwraps ok responses and throws fallback errors for failed responses', () => {
    expect(getRuntimeResponseData({ ok: true, data: { value: 1 } }, 'fallback')).toEqual({ value: 1 });
    expect(() => getRuntimeResponseData({ ok: false, error: 'failed' }, 'fallback')).toThrow('failed');
    expect(() => getRuntimeResponseData(undefined, 'fallback')).toThrow('fallback');
  });
});
