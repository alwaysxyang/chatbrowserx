import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenshotOverlay } from '../../../../src/ui/content/chat/ScreenshotOverlay';

/**
 * Installs an Image mock that loads asynchronously on the next microtask.
 *
 * @returns A restore callback for the original Image constructor.
 */
function installLoadedImageMock(): () => void {
  const originalImage = globalThis.Image;

  class MockImage {
    naturalWidth = 1024;
    naturalHeight = 768;
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

  return () => {
    Object.defineProperty(globalThis, 'Image', {
      value: originalImage,
      configurable: true,
    });
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ScreenshotOverlay', () => {
  it('renders screenshot controls and cancels with Escape', async () => {
    const onCancel = vi.fn();

    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => 'data:image/png;base64,viewport')}
        onComplete={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('button', { name: '全屏截图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '截图完成' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('captures the visible viewport when fullscreen screenshot is clicked', async () => {
    const onComplete = vi.fn();
    const onCaptureVisibleTab = vi.fn(async () => 'data:image/png;base64,viewport');

    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={onCaptureVisibleTab}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '全屏截图' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('data:image/png;base64,viewport');
    });
    expect(onCaptureVisibleTab).toHaveBeenCalledTimes(1);
  });

  it('captures the selected viewport area when done is clicked', async () => {
    const restoreImage = installLoadedImageMock();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D);
    const toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,cropped');
    const onComplete = vi.fn();
    const onCaptureVisibleTab = vi.fn(async () => 'data:image/png;base64,viewport');

    try {
      render(
        <ScreenshotOverlay
          onCaptureVisibleTab={onCaptureVisibleTab}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: '截图完成' }));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('data:image/png;base64,cropped');
      });
      expect(onCaptureVisibleTab).toHaveBeenCalledTimes(1);
    } finally {
      getContextSpy.mockRestore();
      toDataUrlSpy.mockRestore();
      restoreImage();
    }
  });

  it('keeps the selection area transparent and centers controls below it', () => {
    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => 'data:image/png;base64,viewport')}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId('screenshot-overlay');
    const selection = screen.getByTestId('screenshot-selection');
    const controls = screen.getByTestId('screenshot-controls');
    const selectionLeft = parseFloat(selection.style.left);
    const selectionWidth = parseFloat(selection.style.width);

    expect(overlay).toHaveStyle({ background: 'transparent' });
    expect(selection).toHaveStyle({ background: 'transparent', border: '0px', outlineColor: '#ffffff' });
    expect(controls).toHaveStyle({ transform: 'translateX(-50%)' });
    expect(parseFloat(controls.style.left)).toBeCloseTo(selectionLeft + selectionWidth / 2);
  });

  it('moves the selection when dragging inside and resizes it from the edge', () => {
    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => 'data:image/png;base64,viewport')}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId('screenshot-overlay');
    const selection = screen.getByTestId('screenshot-selection');
    const startLeft = parseFloat(selection.style.left);
    const startTop = parseFloat(selection.style.top);
    const startWidth = parseFloat(selection.style.width);
    const startHeight = parseFloat(selection.style.height);

    fireEvent.pointerDown(overlay, {
      button: 0,
      pointerId: 1,
      clientX: startLeft + startWidth / 2,
      clientY: startTop + startHeight / 2,
    });
    fireEvent.pointerMove(overlay, {
      pointerId: 1,
      clientX: startLeft + startWidth / 2 + 28,
      clientY: startTop + startHeight / 2 + 16,
    });
    fireEvent.pointerUp(overlay, { pointerId: 1 });

    expect(parseFloat(selection.style.left)).toBeCloseTo(startLeft + 28);
    expect(parseFloat(selection.style.top)).toBeCloseTo(startTop + 16);

    const movedLeft = parseFloat(selection.style.left);
    const movedTop = parseFloat(selection.style.top);
    const movedWidth = parseFloat(selection.style.width);
    const movedHeight = parseFloat(selection.style.height);

    fireEvent.pointerMove(overlay, {
      pointerId: 1,
      clientX: movedLeft + movedWidth - 1,
      clientY: movedTop + movedHeight / 2,
    });
    expect(overlay).toHaveStyle({ cursor: 'ew-resize' });

    fireEvent.pointerDown(overlay, {
      button: 0,
      pointerId: 2,
      clientX: movedLeft + movedWidth - 1,
      clientY: movedTop + movedHeight / 2,
    });
    fireEvent.pointerMove(overlay, {
      pointerId: 2,
      clientX: movedLeft + movedWidth + 36,
      clientY: movedTop + movedHeight / 2,
    });
    fireEvent.pointerUp(overlay, { pointerId: 2 });

    expect(parseFloat(selection.style.width)).toBeGreaterThan(movedWidth);
  });
});
