import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  getRuntimeResponseData,
  hasRuntimeMessageType,
  type RuntimeResponse,
  type RuntimeSuccessResponse,
  runtimeErrorResponse,
  runtimeSuccessResponse,
  toRuntimeResponse,
} from '../../../src/shared/types/runtime-messages';
import { chatRequestType } from '../../../src/shared/types/chat';

describe('runtime message helpers', () => {
  it('matches runtime messages by type through shared helpers', () => {
    expect(hasRuntimeMessageType({ type: chatRequestType }, chatRequestType)).toBe(true);
    expect(hasRuntimeMessageType({ type: chatRequestType, payload: { input: 'hello' } }, chatRequestType)).toBe(true);
    expect(hasRuntimeMessageType({ type: 'other' }, chatRequestType)).toBe(false);
    expect(hasRuntimeMessageType(null, chatRequestType)).toBe(false);
  });

  it('unwraps ok responses and throws fallback errors for failed responses', () => {
    expect(getRuntimeResponseData({ ok: true, data: { value: 1 } }, 'fallback')).toEqual({ value: 1 });
    expect(() => getRuntimeResponseData({ ok: false, error: 'failed' }, 'fallback')).toThrow('failed');
    expect(() => getRuntimeResponseData(undefined, 'fallback')).toThrow('fallback');
  });

  it('builds runtime success and error responses through helpers', () => {
    expectTypeOf(runtimeSuccessResponse()).toEqualTypeOf<RuntimeSuccessResponse<null>>();
    expectTypeOf(runtimeSuccessResponse(undefined)).toEqualTypeOf<RuntimeSuccessResponse<null>>();
    expect(runtimeSuccessResponse({ value: 1 })).toEqual({
      ok: true,
      data: { value: 1 },
    });

    expect(runtimeSuccessResponse()).toEqual({
      ok: true,
      data: null,
    });

    expect(runtimeSuccessResponse(undefined)).toEqual({
      ok: true,
      data: null,
    });

    expect(runtimeErrorResponse('failed')).toEqual({
      ok: false,
      error: 'failed',
    });
  });

  it('wraps async results into runtime response envelopes', async () => {
    expectTypeOf(toRuntimeResponse(Promise.resolve())).toEqualTypeOf<Promise<RuntimeResponse<null>>>();
    expectTypeOf(toRuntimeResponse(Promise.resolve(undefined))).toEqualTypeOf<Promise<RuntimeResponse<null>>>();
    await expect(toRuntimeResponse(Promise.resolve({ value: 1 }))).resolves.toEqual({
      ok: true,
      data: { value: 1 },
    });

    await expect(toRuntimeResponse(Promise.resolve())).resolves.toEqual({
      ok: true,
      data: null,
    });

    await expect(toRuntimeResponse(Promise.resolve(undefined))).resolves.toEqual({
      ok: true,
      data: null,
    });

    await expect(toRuntimeResponse(Promise.reject(new Error('failed')))).resolves.toEqual({
      ok: false,
      error: 'failed',
    });
  });
});
