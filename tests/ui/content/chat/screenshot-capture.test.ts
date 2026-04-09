import { afterEach, describe, expect, it, vi } from 'vitest';
import { cropScreenshotDataUrl } from '../../../../src/ui/content/chat/screenshot-capture';

describe('ui screenshot capture', () => {
  const originalImage = globalThis.Image;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    Object.defineProperty(globalThis, 'Image', {
      value: originalImage,
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('keeps the cropped image display ratio when screenshot X and Y scales differ', async () => {
    class MockImage {
      naturalWidth = 2000;
      naturalHeight = 800;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      value: MockImage as unknown as typeof Image,
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    });

    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cropped');

    await expect(
      cropScreenshotDataUrl('data:image/png;base64,source', {
        left: 20,
        top: 30,
        width: 100,
        height: 100,
      }),
    ).resolves.toBe('data:image/png;base64,cropped');

    const canvas = vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.contexts[0] as unknown as HTMLCanvasElement;
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
    expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 40, 30, 200, 100, 0, 0, 100, 100);
  });
});
