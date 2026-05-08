import { describe, expect, it } from 'vitest';
import { isRootScreenshotScrollTarget } from '../../../../src/ui/content/chat/use-screenshot-scroll-forwarding';

describe('screenshot scroll forwarding helpers', () => {
  it('recognizes document-level scroll targets', () => {
    expect(isRootScreenshotScrollTarget(document)).toBe(true);
    expect(isRootScreenshotScrollTarget(window)).toBe(true);
    expect(isRootScreenshotScrollTarget(document.documentElement)).toBe(true);
    expect(isRootScreenshotScrollTarget(document.createElement('div'))).toBe(false);
  });
});
