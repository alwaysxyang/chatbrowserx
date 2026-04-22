import { describe, expect, it } from 'vitest';
import {
  isSelectionCancelMessage,
  isSelectionRequestMessage,
  isSelectionStreamChunkMessage,
  selectionCancelType,
  selectionRequestType,
  selectionStreamChunkType,
} from '../../../src/shared/types/selection';

describe('selection message guards', () => {
  it('accepts selection request messages', () => {
    expect(isSelectionRequestMessage({
      type: selectionRequestType,
      payload: { requestId: 'r1', mode: 'translate', prompt: 'hello' },
    })).toBe(true);
  });

  it('rejects malformed selection request messages', () => {
    expect(isSelectionRequestMessage({ type: selectionRequestType, payload: {} })).toBe(false);
  });

  it('accepts selection stream chunk messages', () => {
    expect(isSelectionStreamChunkMessage({
      type: selectionStreamChunkType,
      payload: { requestId: 'r1', content: 'chunk' },
    })).toBe(true);
  });

  it('accepts selection cancel messages', () => {
    expect(isSelectionCancelMessage({ type: selectionCancelType })).toBe(true);
  });
});

