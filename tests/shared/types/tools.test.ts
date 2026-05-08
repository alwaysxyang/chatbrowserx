import { describe, expect, it } from 'vitest';
import {
  isPageActionDirection,
  pageActionDirections,
} from '../../../src/shared/types/tools';

describe('tool shared types', () => {
  it('exposes the page action direction contract from the protocol layer', () => {
    expect(pageActionDirections).toEqual(['up', 'down', 'left', 'right']);
    expect(isPageActionDirection('up')).toBe(true);
    expect(isPageActionDirection('sideways')).toBe(false);
    expect(isPageActionDirection(undefined)).toBe(false);
  });
});
