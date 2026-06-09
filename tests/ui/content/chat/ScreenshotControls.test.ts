import { afterEach, describe, expect, it } from 'vitest';
import { buildScreenshotControlsStyle } from '../../../../src/ui/content/chat/ScreenshotControls';
import type { ScreenshotRect } from '../../../../src/ui/content/chat/screenshot/screenshot-types';

const originalInnerWidth = window.innerWidth;

describe('screenshot controls helpers', () => {
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('centers controls under the selected screenshot rectangle', () => {
    const selection: ScreenshotRect = { left: 100, top: 120, width: 240, height: 160 };
    const style = buildScreenshotControlsStyle(selection, 800);

    expect(style.left).toBe('220px');
    expect(style.top).toBe('290px');
    expect(style.transform).toBe('translateX(-50%)');
  });

  it('keeps controls inside the left viewport edge', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 320,
    });

    const selection: ScreenshotRect = { left: 0, top: 120, width: 40, height: 160 };
    const style = buildScreenshotControlsStyle(selection, 800);

    expect(Number.parseFloat(String(style.left))).toBeGreaterThanOrEqual(98);
    expect(style.transform).toBe('translateX(-50%)');
  });
});
