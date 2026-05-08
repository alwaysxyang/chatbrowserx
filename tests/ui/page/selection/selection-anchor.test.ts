import { describe, expect, it } from 'vitest';
import {
  computeSelectionAnchor,
  getPointerDistance,
} from '../../../../src/ui/page/selection/selection-anchor';

describe('selection anchor helpers', () => {
  it('keeps the anchor inside the viewport and chooses below when top space is tight', () => {
    const anchor = computeSelectionAnchor(new DOMRect(0, 100, 10, 24), {
      viewportWidth: 1024,
      viewportHeight: 768,
    });

    expect(anchor.left).toBeGreaterThanOrEqual(226);
    expect(anchor.placement).toBe('below');
  });

  it('measures pointer movement in viewport pixels', () => {
    expect(getPointerDistance({ x: 10, y: 20 }, { x: 13, y: 24 })).toBe(5);
  });
});
